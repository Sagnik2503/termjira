const { readFileSync, writeFileSync } = require('node:fs')

const STORE_PATH = "issue_store.json"

class Issue {
    constructor(id, title, description, status, priority, labels) {
        this.id = id
        this.title = title
        this.description = description
        this.status = status
        this.priority = priority
        this.labels = labels
    }
    created_timestamp=Date.now()
    updated_timestamp=this.created_timestamp

}

const STATUSES = ["TODO", "IN_PROGRESS", "CLOSED"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"]

function normalize_labels(labels) {
    const list = Array.isArray(labels) ? labels : String(labels ?? "").split(",")
    const seen = new Set()
    const result = []
    for (const label of list) {
        const value = String(label).trim().toLowerCase()
        if (!value || seen.has(value)) continue
        seen.add(value)
        result.push(value)
    }
    return result
}

function read_issues() {
    try {
        const data = JSON.parse(readFileSync(STORE_PATH, "utf8"))
        if (!Array.isArray(data)) {
            console.log("Issue store is not a list, starting empty.")
            return []
        }
        return data
    } catch (error) {
        if (error.code !== "ENOENT") console.log(`Could not load issues: ${error.message}`)
        return []
    }
}

function write_issues(issues) {
    try {
        writeFileSync(STORE_PATH, JSON.stringify(issues, null, 2), "utf8")
    } catch (error) {
        console.log(`Could not save issues: ${error.message}`)
    }
}

function next_id(issues) {
    return issues.reduce((max, issue) => Math.max(max, issue.id), 0) + 1
}

function create_issue(title, description, status = "TODO", priority = "MEDIUM", labels = []) {
    title = String(title ?? "").trim()
    description = String(description ?? "").trim()
    status = String(status ?? "").trim().toUpperCase() || "TODO"
    priority = String(priority ?? "").trim().toUpperCase() || "MEDIUM"

    if (!title) {
        console.log("Title cannot be empty.")
        return
    }
    if (!description) {
        console.log("Description cannot be empty.")
        return
    }
    if (!STATUSES.includes(status)) {
        console.log(`Invalid status. Choose between ${STATUSES.join(", ")}`)
        return
    }
    if (!PRIORITIES.includes(priority)) {
        console.log(`Invalid priority. Choose between ${PRIORITIES.join(", ")}`)
        return
    }

    const issues = read_issues()
    const issue = new Issue(next_id(issues), title, description, status, priority, normalize_labels(labels))
    issues.push(issue)
    write_issues(issues)
    return issue
}

function format_issue(issue) {
    return `ID:          ${issue.id}
Title:       ${issue.title}
Description: ${issue.description}
Status:      ${issue.status}
Priority:    ${issue.priority}
Labels:      ${issue.labels.length ? issue.labels.join(", ") : "(none)"}
Created:     ${new Date(issue.created_timestamp).toLocaleString()}
Updated:     ${new Date(issue.updated_timestamp).toLocaleString()}`
}

function list_issues() {
    const issues = read_issues()
    if (issues.length === 0) {
        console.log("No issues found")
        return
    }

    console.log(issues.map(format_issue).join("\n\n"))
}

function show_issue(id) {
    const issue = get_issue(id)
    if (!issue) {
        console.log("Issue not found.")
        return
    }
    console.log(format_issue(issue))
}

function edit_title(id, title) {
    title = String(title ?? "").trim()
    if (!title) {
        console.log("Title cannot be empty.")
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        console.log("Issue DNE")
        return
    }
    issue.title = title
    issue.updated_timestamp = Date.now()
    write_issues(issues)
    return issue
}

function edit_description(id, description) {
    description = String(description ?? "").trim()
    if (!description) {
        console.log("Description cannot be empty.")
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        console.log("Issue DNE")
        return
    }
    issue.description = description
    issue.updated_timestamp = Date.now()
    write_issues(issues)
    return issue
}

function update_status(id, new_status) {
    if (!STATUSES.includes(new_status)) {
        console.log(`New status name is incorrect. Choose between "IN_PROGRESS", "TODO", "CLOSED"`)
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        console.log("Issue DNE")
        return
    }
    issue.status = new_status
    issue.updated_timestamp = Date.now()
    write_issues(issues)
    return issue
}

function update_priority(id, new_priority) {
    const priority = String(new_priority ?? "").toUpperCase()
    if (!PRIORITIES.includes(priority)) {
        console.log(`Invalid priority. Choose between "LOW", "MEDIUM", "HIGH"`)
        return
    }
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        console.log("Issue DNE")
        return
    }
    issue.priority = priority
    issue.updated_timestamp = Date.now()
    write_issues(issues)
    return issue
}

function add_labels(id, labels) {
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        console.log("Issue DNE")
        return
    }
    let changed = false
    for (const label of normalize_labels(labels)) {
        if (issue.labels.includes(label)) {
            console.log(`Issue #${issue.id} already has label "${label}".`)
            continue
        }
        issue.labels.push(label)
        console.log(`Added "${label}" to issue #${issue.id}.`)
        changed = true
    }
    if (changed) {
        issue.updated_timestamp = Date.now()
        write_issues(issues)
    }
    return issue
}

function remove_labels(id, labels) {
    const issues = read_issues()
    const issue = issues.find(element => element.id === id)
    if (!issue) {
        console.log("Issue DNE")
        return
    }
    let changed = false
    for (const label of normalize_labels(labels)) {
        const index = issue.labels.indexOf(label)
        if (index === -1) {
            console.log(`Issue #${issue.id} does not have label "${label}".`)
            continue
        }
        issue.labels.splice(index, 1)
        console.log(`Removed "${label}" from issue #${issue.id}.`)
        changed = true
    }
    if (changed) {
        issue.updated_timestamp = Date.now()
        write_issues(issues)
    }
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
        console.log("No labels in use.")
        return
    }
    const names = [...counts.keys()].sort()
    const width = Math.max(...names.map(name => name.length))
    for (const name of names) {
        const count = counts.get(name)
        console.log(`${name.padEnd(width)}  ${count} ${count === 1 ? "issue" : "issues"}`)
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
        console.log("Issue DNE")
        return
    }
    const [issue] = issues.splice(index, 1)
    write_issues(issues)
    return issue
}

function count_issues() {
    return read_issues().length
}

function filter_issues(status, priority, title, description, labels = []) {
    status = String(status ?? "").trim().toUpperCase()
    priority = String(priority ?? "").trim().toUpperCase()
    title = String(title ?? "").trim().toLowerCase()
    description = String(description ?? "").trim().toLowerCase()
    labels = normalize_labels(labels)
    if (status && !STATUSES.includes(status)) {
        console.log(`Invalid status. Choose between ${STATUSES.join(", ")}`)
        return null
    }
    if (priority && !PRIORITIES.includes(priority)) {
        console.log(`Invalid priority. Choose between ${PRIORITIES.join(", ")}`)
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

module.exports = { create_issue, list_issues, show_issue, format_issue, edit_description, edit_title, update_status, update_priority, add_labels, remove_labels, list_labels, get_issue, delete_issue, filter_issues, count_issues, STATUSES, PRIORITIES }
