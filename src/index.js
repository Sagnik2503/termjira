const readline = require('readline')
const prompt = require("prompt-sync")()
const { create_issue, list_issues, show_issue, format_issue, format_row, edit_description, edit_title, update_status, update_priority, add_labels, remove_labels, list_labels, get_issue, delete_issue, filter_issues, sort_issues, count_issues, STATUSES, PRIORITIES} = require('./issue')
const { markAsUncloneable } = require('worker_threads')

// seed issues for development on an empty store only
if (count_issues() === 0) {
// Normal issues
create_issue("Learn JavaScript", "Practice functions", "TODO", "HIGH", ["learning"])
create_issue("Build TermJira", "Implement issue creation", "IN_PROGRESS", "HIGH", ["feature", "backend"])
create_issue("Write unit tests", "Test CRUD operations", "TODO", "MEDIUM", ["testing"])
create_issue("Update documentation", "Document CLI commands", "CLOSED", "LOW", ["docs"])

// Duplicate and case-insensitive search
create_issue("Fix login bug", "Fix authentication", "IN_PROGRESS", "HIGH", ["bug", "auth"])
create_issue("Fix Login Bug", "Handle invalid credentials", "TODO", "LOW", ["bug", "auth"])

// Similar keywords
create_issue("Improve search", "Support partial matches", "TODO", "MEDIUM", ["search"])
create_issue("Search by priority", "Filter issues by priority", "CLOSED", "HIGH", ["search"])

// Special characters and numbers
create_issue("Handle --status flag", "Parse CLI arguments", "IN_PROGRESS", "MEDIUM", ["cli"])
create_issue("Fix #123 error", "Resolve issue reference bug", "TODO", "LOW", ["bug"])
}

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
    console.log("show <id> - show an issue");
    console.log("update <id> <title|description|status|priority> <value> - update an issue field");
    console.log("delete <id> [--force] - delete an issue (asks for confirmation unless --force)");
    console.log("label list - list all labels in use");
    console.log("label add <id> <label>[,<label>...] - add labels to an issue");
    console.log("label remove <id> <label>[,<label>...] - remove labels from an issue");
    console.log('filter [--status <status>] [--priority <priority>] [--title "<text>"] [--description "<text>"] [--label <label>] - filter issues');
    console.log("sort [--by id|priority|status|created] [--order asc|desc] - sort issues");
    console.log("exit - Exit TermJira");
}

function confirm(question) {
    return new Promise(resolve => rl.question(question, answer => resolve(answer)))
}

function askField(name, values, fallback) {
    while (true) {
        const value = String(prompt(`${name} for the issue (${values.join(", ")}): `) ?? "").trim().toUpperCase()
        if (!value) return fallback
        if (values.includes(value)) return value
        console.log(`Invalid ${name.toLowerCase()}. Choose between ${values.join(", ")}`)
    }
}

const commands = {
    help: showHelp,
    list: list_issues,
    show: ([id]) => {
        if (!id) {
            console.log("Usage: show <id>")
            return
        }
        show_issue(Number(id))
    },
    create: () => {
        const title = prompt("Title for the issue: ");
        const description = prompt("Description for the issue: ");
        const status = askField("Status", STATUSES, "TODO");
        const priority = askField("Priority", PRIORITIES, "MEDIUM");
        const labels = prompt("Labels for the issue (optional, comma separated): ");
        const issue = create_issue(title, description, status, priority, labels);
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
    delete: async (args)=>{
        const id = Number(args[0])
        const force = args.includes("--force")
        if (!Number.isInteger(id)) {
            console.log("Usage: delete <id> [--force]")
            return
        }
        const issue = get_issue(id)
        if (!issue) {
            console.log("Issue DNE")
            return
        }
        if (!force) {
            const answer = String(await confirm(`Delete issue #${issue.id} "${issue.title}"? (y/N) `)).trim().toLowerCase()
            if (answer !== "y" && answer !== "yes") {
                console.log("Delete cancelled.")
                return
            }
        }
        const deleted = delete_issue(id)
        if (deleted) console.log(`Deleted issue #${deleted.id}: ${deleted.title}`)
    },
    label: (args)=>{
        const action = String(args[0] ?? "").toLowerCase()
        if(action === "list"){
            list_labels()
            return
        }
        const id = Number(args[1])
        if((action !== "add" && action !== "remove") || !Number.isInteger(id)){
            console.log("Usage: label list | label add|remove <id> <label>[,<label>...]")
            return
        }
        const labels = args.slice(2).join(" ")
            .split(",")
            .map(label => label.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean)
        if(labels.length === 0){
            console.log(`Usage: label ${action} <id> <label>[,<label>...]`)
            return
        }
        if(action === "add") add_labels(id, labels)
        else remove_labels(id, labels)
    },
    sort: (args)=>{
        const options={}
        for(let i=0;i<args.length;i+=2){
            const flag=args[i]
            if((flag!=="--by" && flag!=="--order") || args[i+1]===undefined || args[i+1].startsWith("--")){
                console.log("Usage: sort [--by id|priority|status|created] [--order asc|desc]")
                return
            }
            options[flag.slice(2)]=args[i+1]
        }
        const result=sort_issues(options.by, options.order)
        if (result === null) return
        if (result.length === 0) {
            console.log("No issues found")
            return
        }
        result.forEach(issue => console.log(format_row(issue, true)))
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
            } else if(key==="label"){
                if(!raw){
                    console.log("--label requires a value")
                    return
                }
                flags.label=flags.label ?? []
                flags.label.push(raw.replace(/^["']|["']$/g, ""))
            } else {
                flags[key]=raw.replace(/^["']|["']$/g, "")
            }
        }
        const result=filter_issues(flags.status, flags.priority, flags.title, flags.description, flags.label)
        if (result === null) return
        if (result.length === 0) {
            console.log("No matching issues found.")
        } else {
            result.forEach(issue => console.log(format_row(issue)))
        }
    }
}

showWelcome()
function askCommand() {
    console.log()
    rl.question("tj> ", async (answer) => {
        const [command, ...args] = answer.trim().split(/\s+/)
        const handler = commands[command.toLowerCase()]
        if (!handler) {
            console.log("unknown command")
        } else {
            const result = handler(args)
            if (result === false) return
            if (result instanceof Promise) await result
        }
        askCommand()
    })
}
askCommand()
