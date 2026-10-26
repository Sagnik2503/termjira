class Issue {
    constructor(id, title, description, status, priority, labels) {
        this.id = id
        this.title = title
        this.description = description
        this.status = status
        this.priority = priority
        this.labels = labels
    }
}

const issue_store = []
let currentIssue=null
let next_id=1

function checkout_issue(id){
    const issue = issue_store.find(element => element.id === id)
    if (!issue) {
        console.log("Issue does not exist.")
        return
    }
    currentIssue=issue
    console.log(`Checked out issue #${currentIssue.id}: ${currentIssue.title}`)
}
const STATUSES = ["TODO", "IN_PROGRESS", "CLOSED"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"]

function normalize_labels(labels) {
    const list = Array.isArray(labels) ? labels : String(labels ?? "").split(",")
    return list.map(label => String(label).trim()).filter(Boolean)
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

    const issue = new Issue(next_id++, title, description, status, priority, normalize_labels(labels))
    issue_store.push(issue)
    return issue
}

function format_issue(issue) {
    return `ID:          ${issue.id}
Title:       ${issue.title}
Description: ${issue.description}
Status:      ${issue.status}
Priority:    ${issue.priority}
Labels:      ${issue.labels.join(", ")}`
}

function list_issues() {
    if (issue_store.length === 0) {
        console.log("No issues found")
        return
    }
    console.log(issue_store.map(format_issue).join("\n\n"))
}

function show_issue(id) {
    const issue = issue_store.find(element => element.id === id)
    if (!issue) {
        console.log("Issue not found.")
        return
    }
    console.log(format_issue(issue))
}

function get_current_issue() {
    return currentIssue
}

function edit_title(id,title){
    title = String(title ?? "").trim()
    if(!title){
        console.log("Title cannot be empty.")
        return
    }
    const issue = issue_store.find(element => element.id === id)
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.title=title
    return issue
}

function edit_description(id,description){
    description = String(description ?? "").trim()
    if(!description){
        console.log("Description cannot be empty.")
        return
    }
    const issue = issue_store.find(element => element.id === id)
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.description=description
    return issue
}

function update_status(id, new_status){
    const issue = issue_store.find(element => element.id === id)
    if(!STATUSES.includes(new_status)){
        console.log(`New status name is incorrect. Choose between "IN_PROGRESS", "TODO", "CLOSED"`)
        return
    }
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.status=new_status
    return issue
}

function update_priority(id, new_priority){
    const priority = String(new_priority ?? "").toUpperCase()
    if(!PRIORITIES.includes(priority)){
        console.log(`Invalid priority. Choose between "LOW", "MEDIUM", "HIGH"`)
        return
    }
    const issue = issue_store.find(element => element.id === id)
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.priority=priority
    return issue
}

function delete_issue(id){
    const index = issue_store.findIndex(element => element.id === id)
    if(index === -1){
        console.log("Issue DNE")
        return
    }
    const [issue] = issue_store.splice(index, 1)
    if(currentIssue === issue){
        currentIssue = null
    }
    return issue
}

function filter_issues(status, priority, title, description){
    status = String(status ?? "").trim().toUpperCase()
    priority = String(priority ?? "").trim().toUpperCase()
    title = String(title ?? "").trim().toLowerCase()
    description = String(description ?? "").trim().toLowerCase()
    if (status && !STATUSES.includes(status)) {
        console.log(`Invalid status. Choose between ${STATUSES.join(", ")}`)
        return null
    }
    if (priority && !PRIORITIES.includes(priority)) {
        console.log(`Invalid priority. Choose between ${PRIORITIES.join(", ")}`)
        return null
    }
    return issue_store.filter(element =>
        (!status || element.status === status) &&
        (!priority || element.priority === priority) &&
        (!title || element.title.toLowerCase().includes(title)) &&
        (!description || element.description.toLowerCase().includes(description))
    )
}

module.exports = { create_issue, list_issues, show_issue, format_issue, checkout_issue, get_current_issue , edit_description, edit_title, update_status, update_priority, delete_issue, filter_issues, STATUSES, PRIORITIES}
