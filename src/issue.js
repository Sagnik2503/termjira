const { copyFileSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } = require('node:fs')
const { color_label, log_error, log_warn, log_success } = require('./colors')
const { format_issue, format_row, format_list, strip_control } = require('./format')
const os = require('node:os')
const path = require('node:path')

const STORE_DIR = process.env.TERMJIRA_HOME || path.join(os.homedir(), '.termjira')
const STORE_PATH = path.join(STORE_DIR, 'issue_store.json')

let failed_load = false

try {
    mkdirSync(STORE_DIR, { recursive: true })
} catch (error) {
    failed_load = true
    log_error(`Could not create the issue store at ${STORE_DIR}: ${error.message}. Check that the folder is writable.`)
}

class Issue {
    constructor(id, title, description, status, priority, labels) {
        this.id = id
        this.title = title
        this.description = description
        this.status = status
        this.priority = priority
        this.labels = labels
        this.comments=[]
    }
    created_timestamp=Date.now()
    updated_timestamp=this.created_timestamp

}

const STATUSES = ["TODO", "IN_PROGRESS", "CLOSED"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"]

function issue_not_found(id) {
    log_error(`Issue #${id} not found. Try "list" to see valid IDs.`)
}

function normalize_labels(labels) {
    const list = Array.isArray(labels) ? labels : String(labels ?? "").split(",")
    const seen = new Set()
    const result = []
    for (const label of list) {
        const value = strip_control(String(label)).trim().toLowerCase()
        if (!value || seen.has(value)) continue
        seen.add(value)
        result.push(value)
    }
    return result
}

function normalize_comments(comments = []) {
    return comments.map((comment, index) =>
        typeof comment === "string"
            ? { id: index + 1, text: comment }
            : { id: comment.id ?? index + 1, text: String(comment.text ?? "") }
    )
}

function preserve_broken_store(reason) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backup_path = `${STORE_PATH}.${stamp}.bak`
    failed_load = true
    try {
        copyFileSync(STORE_PATH, backup_path)
        log_error(`Could not load issues: ${reason}. Kept a copy at ${backup_path}. Refusing to write until it is fixed.`)
    } catch (error) {
        log_error(`Could not load issues: ${reason}. Could not back it up: ${error.message}. Refusing to write until it is fixed.`)
    }
}

function read_issues() {
    if (failed_load) return []
    let data
    try {
        data = JSON.parse(readFileSync(STORE_PATH, "utf8"))
    } catch (error) {
        if (error.code === "ENOENT") return []
        preserve_broken_store(error.message)
        return []
    }
    if (!Array.isArray(data)) {
        preserve_broken_store("Issue store is not a list")
        return []
    }
    for (const issue of data) {
        issue.title = strip_control(issue.title)
        issue.description = strip_control(issue.description)
        if (Array.isArray(issue.labels)) issue.labels = issue.labels.map(strip_control)
        issue.comments = normalize_comments(issue.comments)
            .map(comment => ({ ...comment, text: strip_control(comment.text) }))
    }
    return data
}

function write_issues(issues) {
    if (failed_load) {
        log_error("Refusing to save issues: the issue store failed to load. Fix or remove the backup first.")
        return false
    }
    const temp_path = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`
    try {
        writeFileSync(temp_path, JSON.stringify(issues, null, 2), "utf8")
        renameSync(temp_path, STORE_PATH)
        return true
    } catch (error) {
        log_error(`Could not save issues: ${error.message}`)
        try { unlinkSync(temp_path) } catch {}
        return false
    }
}

function next_id(issues) {
    return issues.reduce((max, issue) => Math.max(max, issue.id), 0) + 1
}

function create_issue(title, description, status = "TODO", priority = "MEDIUM", labels = []) {
    title = strip_control(String(title ?? "")).trim()
    description = strip_control(String(description ?? "")).trim()
    status = String(status ?? "").trim().toUpperCase() || "TODO"
    priority = String(priority ?? "").trim().toUpperCase() || "MEDIUM"

    if (!title) {
        log_error("Title cannot be empty.")
        return
    }
    if (!description) {
        log_error("Description cannot be empty.")
        return
    }
    if (!STATUSES.includes(status)) {
        log_error(`Invalid status. Choose between ${STATUSES.join(", ")}`)
        return
    }
    if (!PRIORITIES.includes(priority)) {
        log_error(`Invalid priority. Choose between ${PRIORITIES.join(", ")}`)
        return
    }

    const issues = read_issues()
    const issue = new Issue(next_id(issues), title, description, status, priority, normalize_labels(labels))
    issues.push(issue)
    if (!write_issues(issues)) return
    return issue
}

function list_issues() {
    const issues = read_issues()
    if (issues.length === 0) {
        log_warn('No issues yet — create one with "create".')
        return
    }
    console.log(format_list(issues, { context: `Issues · ${issues.length}` }))
}

function show_issue(id) {
    const issue = get_issue(id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    console.log(format_issue(issue))
}

function edit_title(id, title) {
    title = strip_control(String(title ?? "")).trim()
    if (!title) {
        log_error("Title cannot be empty.")
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    issue.title = title
    issue.updated_timestamp = Date.now()
    if (!write_issues(issues)) return
    return issue
}

function edit_description(id, description) {
    description = strip_control(String(description ?? "")).trim()
    if (!description) {
        log_error("Description cannot be empty.")
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    issue.description = description
    issue.updated_timestamp = Date.now()
    if (!write_issues(issues)) return
    return issue
}

function update_status(id, new_status) {
    const status = String(new_status ?? "").trim().toUpperCase()
    if (!STATUSES.includes(status)) {
        log_error(`New status name is incorrect. Choose between "IN_PROGRESS", "TODO", "CLOSED"`)
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    issue.status = status
    issue.updated_timestamp = Date.now()
    if (!write_issues(issues)) return
    return issue
}

function update_priority(id, new_priority) {
    const priority = String(new_priority ?? "").trim().toUpperCase()
    if (!PRIORITIES.includes(priority)) {
        log_error(`Invalid priority. Choose between "LOW", "MEDIUM", "HIGH"`)
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    issue.priority = priority
    issue.updated_timestamp = Date.now()
    if (!write_issues(issues)) return
    return issue
}

function publish_label_events(events) {
    for (const [kind, message] of events) {
        if (kind === "warn") log_warn(message)
        else log_success(message)
    }
}

function add_labels(id, labels) {
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    const events = []
    for (const label of normalize_labels(labels)) {
        if (issue.labels.includes(label)) {
            events.push(["warn", `Issue #${issue.id} already has label "${label}".`])
            continue
        }
        issue.labels.push(label)
        events.push(["success", `Added "${label}" to issue #${issue.id}.`])
    }
    const changed = events.some(([kind]) => kind === "success")
    if (changed) {
        issue.updated_timestamp = Date.now()
        if (!write_issues(issues)) return
    }
    publish_label_events(events)
    return issue
}

function remove_labels(id, labels) {
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        issue_not_found(id)
        return
    }
    const events = []
    for (const label of normalize_labels(labels)) {
        const index = issue.labels.indexOf(label)
        if (index === -1) {
            events.push(["warn", `Issue #${issue.id} does not have label "${label}".`])
            continue
        }
        issue.labels.splice(index, 1)
        events.push(["success", `Removed "${label}" from issue #${issue.id}.`])
    }
    const changed = events.some(([kind]) => kind === "success")
    if (changed) {
        issue.updated_timestamp = Date.now()
        if (!write_issues(issues)) return
    }
    publish_label_events(events)
    return issue
}

function list_labels() {
    const counts = new Map()
    for (const issue of read_issues()) {
        for (const label of issue.labels) {
            counts.set(label, (counts.get(label) ?? 0) + 1)
        }
    }
    if (counts.size === 0) {
        log_warn('No labels in use yet. Add one with "label add <id> <label>".')
        return
    }
    const names = [...counts.keys()].sort()
    const width = Math.max(...names.map(name => name.length))
    for (const name of names) {
        const count = counts.get(name)
        console.log(`${color_label(name.padEnd(width))}  ${count} ${count === 1 ? "issue" : "issues"}`)
    }
    console.log()
    console.log(`${counts.size} ${counts.size === 1 ? "label" : "labels"} in use.`)
}

function get_issue(id) {
    return read_issues().find(element => element.id === id)
}

function delete_issue(id) {
    const issues = read_issues()
    const index = issues.findIndex(element => element.id === id)
    if (index === -1) {
        issue_not_found(id)
        return
    }
    const [issue] = issues.splice(index, 1)
    if (!write_issues(issues)) return
    return issue
}

function count_issues() {
    return read_issues().length
}

const SORT_KEYS = {
    id: issue => issue.id,
    priority: issue => PRIORITIES.indexOf(issue.priority),
    status: issue => STATUSES.indexOf(issue.status),
    created: issue => issue.created_timestamp,
}

function sort_issues(by = "id", order = "asc", issues = read_issues()) {
    const key = SORT_KEYS[by]
    if (!key) {
        log_error(`Invalid sort field. Choose between ${Object.keys(SORT_KEYS).join(", ")}`)
        return null
    }
    if (order !== "asc" && order !== "desc") {
        log_error("Invalid sort order. Choose between asc, desc")
        return null
    }
    const direction = order === "asc" ? 1 : -1
    return [...issues].sort((a, b) => (key(a) - key(b)) * direction || a.id - b.id)
}

function filter_issues(status, priority, title, description, labels = []) {
    status = String(status ?? "").trim().toUpperCase()
    priority = String(priority ?? "").trim().toUpperCase()
    title = String(title ?? "").trim().toLowerCase()
    description = String(description ?? "").trim().toLowerCase()
    labels = normalize_labels(labels)
    if (status && !STATUSES.includes(status)) {
        log_error(`Invalid status. Choose between ${STATUSES.join(", ")}`)
        return null
    }
    if (priority && !PRIORITIES.includes(priority)) {
        log_error(`Invalid priority. Choose between ${PRIORITIES.join(", ")}`)
        return null
    }
    return read_issues().filter(element =>
        (!status || element.status === status) &&
        (!priority || element.priority === priority) &&
        (!title || element.title.toLowerCase().includes(title)) &&
        (!description || element.description.toLowerCase().includes(description)) &&
        labels.every(label => element.labels.includes(label))
    )
}

function add_comments(id, comment){
    const text = strip_control(String(comment ?? "")).trim()
    if(text === ""){
        log_error("Provide a comment")
        return
    }
    const issues=read_issues()
    const target_issue=issues.find((issue)=>issue.id===id)
    if(!target_issue){
        issue_not_found(id)
        return
    }
    target_issue.comments.push({ id: target_issue.comments.reduce((max, c) => Math.max(max, c.id), 0) + 1, text })
    target_issue.updated_timestamp = Date.now()
    if (!write_issues(issues)) return
    return target_issue
}

function delete_comment(issueId, commentId){
    const issues=read_issues()
    const target_issue=issues.find((issue)=>issue.id===issueId)
    if(!target_issue){
        issue_not_found(issueId)
        return
    }
    const index=target_issue.comments.findIndex((comment)=>comment.id===commentId)
    if(index === -1){
        log_error(`Comment #${commentId} not found on issue #${issueId}`)
        return
    }
    const [removed]=target_issue.comments.splice(index, 1)
    target_issue.updated_timestamp = Date.now()
    if (!write_issues(issues)) return
    return removed
}

module.exports = { create_issue, list_issues, show_issue, format_issue, format_row, edit_description, edit_title, update_status, update_priority, add_labels, remove_labels, list_labels, get_issue, delete_issue, filter_issues, sort_issues, count_issues, add_comments, delete_comment, issue_not_found, STATUSES, PRIORITIES }
