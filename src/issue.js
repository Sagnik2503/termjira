class Issue {
    constructor(id, title, description, status, priority) {
        this.id = id
        this.title = title
        this.description = description
        this.status = status
        this.priority = priority
    }
}

const issue_store = []
let currentIssue=null

function checkout_issue(id){
    const issue = issue_store.find(element => element.id === id)
    if (!issue) {
        console.log("Issue does not exist.")
        return
    }
    currentIssue=issue
    console.log(`Checked out issue #${currentIssue.id}: ${currentIssue.title}`)
}
function create_issue(title, description, status = "TODO", priority = "MEDIUM") {
    const issue = new Issue(issue_store.length + 1, title, description, status, priority)
    issue_store.push(issue)
    return issue
}

function list_issues() {
    if (issue_store.length === 0) {
        console.log("No issues found")
    }
    for (const issue of issue_store) {
        console.log(`ID: ${issue.id} | ${issue.title} | ${issue.description} | ${issue.status} | ${issue.priority}`)
    }
}

function show_issue(id) {
    const issue = issue_store.find(element => element.id === id)
    if (!issue) {
        console.log("Issue not found.")
        return
    }
    console.log(`
    ID:          ${issue.id}
    Title:       ${issue.title}
    Description: ${issue.description}
    Status:      ${issue.status}
    Priority:     ${issue.priority}
    `)
}

function get_current_issue() {
    return currentIssue
}

function edit_title(id,title){
    const issue = issue_store.find(element => element.id === id)
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.title=title
    return issue

}

function edit_description(id,description){
    const issue = issue_store.find(element => element.id === id)
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.description=description
    return description

}

function update_status(id, new_status){
    const issue = issue_store.find(element => element.id === id)
    if(!issue){
        console.log("Issue DNE")
        return
    }
    issue.status=new_status
    return issue
}

module.exports = { create_issue, list_issues, show_issue, checkout_issue, get_current_issue , edit_description, edit_title, update_status}
