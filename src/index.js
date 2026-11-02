const readline = require('readline')
const prompt = require("prompt-sync")()
const { create_issue, list_issues, show_issue, format_issue, edit_description, edit_title, update_status, update_priority, add_labels, remove_labels, list_labels, get_issue, delete_issue, filter_issues, sort_issues, count_issues, add_comments, delete_comment, STATUSES, PRIORITIES} = require('./issue')
const { markAsUncloneable } = require('worker_threads')
const { format_list } = require('./format')
const { filter_context, sort_context } = require('./query')
const { log_error, log_warn, color_command, color_help_header, color_muted } = require('./colors')
const { showWelcome } = require('./banner')
const { log } = require('console')

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

const HELP_SECTIONS = [
    ["General", [
        ["help", "Show available commands"],
        ["exit", "Exit TermJira"],
    ]],
    ["Issues", [
        ["create", "Create a new issue"],
        ["list", "List all issues"],
        ["show <id>", "Show an issue"],
        ["update <id> <title|description|status|priority> <value>", "Update an issue field"],
        ["delete <id> [--force]", "Delete an issue (asks for confirmation unless --force)"],
    ]],
    ["Labels", [
        ["label list", "List all labels in use"],
        ["label add <id> <label>[,<label>...]", "Add labels to an issue"],
        ["label remove <id> <label>[,<label>...]", "Remove labels from an issue"],
    ]],
    ["Comments", [
        ["comment add <id> \"<text>\"", "Add a comment to an issue"],
        ["comment delete <id> <commentId>", "Delete a comment from an issue"],
    ]],
    ["Search", [
        ['filter [--status <status>] [--priority <priority>] [--title "<text>"] [--description "<text>"] [--label <label>]', "Filter issues"],
        ["sort [--by id|priority|status|created] [--order asc|desc]", "Sort issues"],
    ]],
]

function showHelp() {
    const width = Math.max(...HELP_SECTIONS.flatMap(([, rows]) => rows.map(([usage]) => usage.length)).filter(length => length < 60))
    console.log(color_help_header("Available commands:"))
    HELP_SECTIONS.forEach(([title, rows]) => {
        console.log()
        console.log(color_help_header(title))
        rows.forEach(([usage, description]) => {
            if (usage.length > width) {
                console.log(`  ${color_command(usage)}`)
                console.log(`    ${color_muted(description)}`)
            } else {
                console.log(`  ${color_command(usage.padEnd(width))}  ${color_muted(description)}`)
            }
        })
    })
}

function confirm(question) {
    return new Promise(resolve => rl.question(question, answer => resolve(answer)))
}

function askField(name, values, fallback) {
    while (true) {
        const value = String(prompt(`${name} for the issue (${values.join(", ")}): `) ?? "").trim().toUpperCase()
        if (!value) return fallback
        if (values.includes(value)) return value
        log_error(`Invalid ${name.toLowerCase()}. Choose between ${values.join(", ")}`)
    }
}

const commands = {
    help: showHelp,
    list: list_issues,
    show: ([id]) => {
        if (!id) {
            log_error("Usage: show <id>")
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
            log_error("Invalid field. Use title, description, status, or priority.")
            return
        }
        const issue = updater(Number(id), value.join(" "))
        if (issue) console.log(format_issue(issue))
    },
    delete: async (args)=>{
        const id = Number(args[0])
        const force = args.includes("--force")
        if (!Number.isInteger(id)) {
            log_error("Usage: delete <id> [--force]")
            return
        }
        const issue = get_issue(id)
        if (!issue) {
            log_error("Issue DNE")
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
            log_error("Usage: label list | label add|remove <id> <label>[,<label>...]")
            return
        }
        const labels = args.slice(2).join(" ")
            .split(",")
            .map(label => label.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean)
        if(labels.length === 0){
            log_error(`Usage: label ${action} <id> <label>[,<label>...]`)
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
                log_error("Usage: sort [--by id|priority|status|created] [--order asc|desc]")
                return
            }
            options[flag.slice(2)]=args[i+1]
        }
        const result=sort_issues(options.by, options.order)
        if (result === null) return
        if (result.length === 0) {
            log_warn('No issues yet — create one with "create".')
            return
        }
        const by = options.by ?? 'id'
        const order = options.order ?? 'asc'
        console.log(format_list(result, { context: sort_context(result.length, by, order) }))
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
                    log_error(`--${key} must be quoted, e.g. --${key} "login page"`)
                    return
                }
                flags[key]=quoted[1]
            } else if(key==="label"){
                if(!raw){
                    log_error("--label requires a value")
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
            log_warn('No matching issues. Try removing a filter.')
            return
        }
        console.log(format_list(result, { context: filter_context(result.length, flags) }))
    },
    comment: (args)=>{
        const action = String(args[0] ?? "").toLowerCase()
        if (action === "add") {
            const id = Number(args[1])
            const raw = args.slice(2).join(" ")
            const quoted = raw.match(/^"([^"]*)"$/) || raw.match(/^'([^']*)'$/)
            if (!Number.isInteger(id) || !quoted || !quoted[1].trim()) {
                log_error('Usage: comment add <id> "<text>"')
                return
            }
            const issue = add_comments(id, quoted[1])
            if (issue) console.log(`Added comment #${issue.comments.at(-1).id} to issue #${issue.id}.`)
            return
        }
        if (action === "delete") {
            const id = Number(args[1])
            const commentId = Number(args[2])
            if (!Number.isInteger(id) || !Number.isInteger(commentId)) {
                log_error("Usage: comment delete <id> <commentId>")
                return
            }
            const removed = delete_comment(id, commentId)
            if (removed) console.log(`Deleted comment #${removed.id} from issue #${id}: ${removed.text}`)
            return
        }
        log_error('Usage: comment add <id> "<text>" | comment delete <id> <commentId>')
    }
}

showWelcome()
console.log(color_muted('Type "help" for available commands.'))
function askCommand() {
    console.log()
    rl.question("tj> ", async (answer) => {
        const [command, ...args] = answer.trim().split(/\s+/)
        const handler = commands[command.toLowerCase()]
        if (!handler) {
            log_error("unknown command")
        } else {
            const result = handler(args)
            if (result === false) return
            if (result instanceof Promise) await result
        }
        askCommand()
    })
}
askCommand()
