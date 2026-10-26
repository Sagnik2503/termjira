const readline = require('readline')
const prompt = require("prompt-sync")()
const { create_issue, list_issues, show_issue, format_issue, checkout_issue, get_current_issue, edit_description, edit_title, update_status, update_priority, delete_issue, filter_issues} = require('./issue')
const { markAsUncloneable } = require('worker_threads')

// seed issues for development
// Normal issues
create_issue("Learn JavaScript", "Practice functions", "TODO", "HIGH")
create_issue("Build TermJira", "Implement issue creation", "IN_PROGRESS", "HIGH")
create_issue("Write unit tests", "Test CRUD operations", "TODO", "MEDIUM")
create_issue("Update documentation", "Document CLI commands", "CLOSED", "LOW")

// Duplicate and case-insensitive search
create_issue("Fix login bug", "Fix authentication", "IN_PROGRESS", "HIGH")
create_issue("Fix Login Bug", "Handle invalid credentials", "TODO", "LOW")

// Similar keywords
create_issue("Improve search", "Support partial matches", "TODO", "MEDIUM")
create_issue("Search by priority", "Filter issues by priority", "CLOSED", "HIGH")

// Special characters and numbers
create_issue("Handle --status flag", "Parse CLI arguments", "IN_PROGRESS", "MEDIUM")
create_issue("Fix #123 error", "Resolve issue reference bug", "TODO", "LOW")

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
    console.log('filter [--status <status>] [--priority <priority>] [--title "<text>"] [--description "<text>"] - filter issues');
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
    },
    filter: (args)=>{
        const flags={}
        for(let i=0;i<args.length;i++){
            if(!args[i].startsWith("--")) continue
            const key=args[i].slice(2)
            const values=[]
            while(i+1<args.length && !args[i+1].startsWith("--")){
                values.push(args[++i])
            }
            const raw=values.join(" ")
            if(key==="title" || key==="description"){
                const quoted=raw.match(/^"([^"]*)"$/) || raw.match(/^'([^']*)'$/)
                if(!quoted){
                    console.log(`--${key} must be quoted, e.g. --${key} "login page"`)
                    return
                }
                flags[key]=quoted[1]
            } else {
                flags[key]=raw.replace(/^["']|["']$/g, "")
            }
        }
        const result=filter_issues(flags.status, flags.priority, flags.title, flags.description)
        if (result === null) return
        if (result.length === 0) {
            console.log("No matching issues found.")
        } else {
            result.forEach(issue => {
                console.log(
                    `#${issue.id} | ${issue.title} | Status: ${issue.status} | Priority: ${issue.priority}`
                )
            })
        }
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
