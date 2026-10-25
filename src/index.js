const readline = require('readline')
const prompt = require("prompt-sync")()
const { create_issue, list_issues, show_issue, format_issue, checkout_issue, get_current_issue, edit_description, edit_title, update_status, update_priority, delete_issue} = require('./issue')

// seed issues for development
create_issue("Learn JavaScript", "Practice functions")
create_issue("Build TermJira", "Implement issue creation")

// creates an interface for terminal input output
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function showWelcome() {
    console.log("Welcome to TermJira!");
}

function showHelp() {
    console.log("Available commands:");
    console.log("help - Show available commands");
    console.log("create - create a new issue");
    console.log("list - list all issues");
    console.log("show [id] - show an issue (defaults to the checked-out issue)");
    console.log("checkout <id> - check out an issue");
    console.log("update <id> <title|description|status|priority> <value> - update an issue field");
    console.log("delete <id> - delete an issue");
    console.log("exit - Exit TermJira");
}

const commands = {
    help: showHelp,
    list: list_issues,
    show: ([id]) => {
        const currentIssue = get_current_issue()
        if (!id && !currentIssue) {
            console.log("No issue checked out.")
            return
        }
        show_issue(id ? Number(id) : currentIssue.id)
    },
    checkout: ([id]) => checkout_issue(Number(id)),
    create: () => {
        const title = prompt("Title for the issue: ");
        const description = prompt("Description for the issue: ");
        const status = prompt("Status for the issue: ");
        const priority = prompt("Priority for the issue: ");
        const issue = create_issue(title, description, status, priority);
        if (issue) console.log(`Issue created! ID: ${issue.id}`);
    },
    exit: () => {
        console.log("Goodbye!")
        rl.close()
        return false
    },
    update: ([id, field, ...value])=>{
        const fields = {
            title: edit_title,
            description: edit_description,
            status: update_status,
            priority: update_priority,
        }
        const updater = fields[String(field).toLowerCase()]
        if (!updater) {
            console.log("Invalid field. Use title, description, status, or priority.")
            return
        }
        const issue = updater(Number(id), value.join(" "))
        if (issue) console.log(format_issue(issue))
    },
    delete: ([id])=>{
        const issue = delete_issue(Number(id))
        if (issue) console.log(`Deleted issue #${issue.id}: ${issue.title}`)
    }
}

showWelcome()
function askCommand() {
    const currentIssue = get_current_issue()
    console.log()
    rl.question(`${currentIssue ? `tj[#${currentIssue.id}]` : "tj"}> `, (answer) => {
        const [command, ...args] = answer.trim().split(/\s+/)
        const handler = commands[command.toLowerCase()]
        if (!handler) {
            console.log("unknown command")
        }
        else if (handler(args) === false) {
            return
        }
        askCommand()
    })
}
askCommand()
