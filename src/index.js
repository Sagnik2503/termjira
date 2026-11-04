const readline = require('readline')
const { create_issue, list_issues, show_issue, format_issue, edit_description, edit_title, update_status, update_priority, add_labels, remove_labels, list_labels, get_issue, delete_issue, filter_issues, sort_issues, count_issues, add_comments, delete_comment, issue_not_found, STATUSES, PRIORITIES} = require('./issue')
const { markAsUncloneable } = require('worker_threads')
const { format_list } = require('./format')
const { filter_context, sort_context } = require('./query')
const { log_error, log_warn, log_success, color_muted } = require('./colors')
const { theme } = require('./theme')
const { show_help } = require('./help')
const { showWelcome } = require('./banner')
const { log } = require('console')

// creates an interface for terminal input output
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let input_closed = false
const buffered_lines = []
const waiting_for_line = []

rl.on('line', line => {
    if (waiting_for_line.length > 0) waiting_for_line.shift()(line)
    else buffered_lines.push(line)
})

rl.on('close', () => {
    input_closed = true
    while (waiting_for_line.length > 0) waiting_for_line.shift()(null)
})

function ask(question) {
    return new Promise(resolve => {
        if (buffered_lines.length > 0) {
            process.stdout.write(question)
            resolve(buffered_lines.shift())
            return
        }
        if (input_closed) {
            resolve(null)
            return
        }
        process.stdout.write(question)
        waiting_for_line.push(resolve)
    })
}

async function askField(name, values, fallback) {
    while (true) {
        const answer = await ask(`${theme.bold(name)} ${theme.muted(`(${values.join(', ')})`)} [${theme.accent(fallback)}]: `)
        if (answer === null) return null
        const value = String(answer).trim().toUpperCase()
        if (!value) return fallback
        if (values.includes(value)) return value
        log_error(`Invalid ${name.toLowerCase()}. Choose between ${values.join(', ')}`)
    }
}

const commands = {
    help: show_help,
    list: list_issues,
    show: ([id]) => {
        if (!id) {
            log_error("Usage: show <id>")
            return
        }
        show_issue(Number(id))
    },
    create: async () => {
        const title = await ask(`${theme.bold("Title")}: `);
        if (title === null) return;
        const description = await ask(`${theme.bold("Description")}: `);
        if (description === null) return;
        const status = await askField("Status", STATUSES, "TODO");
        if (status === null) return;
        const priority = await askField("Priority", PRIORITIES, "MEDIUM");
        if (priority === null) return;
        const labels = await ask(`${theme.bold("Labels")} ${theme.muted("(optional, comma separated)")}: `);
        if (labels === null) return;
        const issue = create_issue(title, description, status, priority, labels);
        if (issue) log_success(`Issue #${issue.id} created — ${issue.title}`);
    },
    exit: () => {
        console.log()
        console.log(`${theme.accent('tj ❯')} ${theme.muted('Goodbye — your issues are saved.')}`)
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
            issue_not_found(id)
            return
        }
        if (!force) {
            const answer = String(await ask(`Delete issue #${issue.id} "${issue.title}"? (y/N) `)).trim().toLowerCase()
            if (answer !== "y" && answer !== "yes") {
                log_warn("Delete cancelled.")
                return
            }
        }
        const deleted = delete_issue(id)
        if (deleted) log_success(`Deleted issue #${deleted.id}: ${deleted.title}`)
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
            if (issue) log_success(`Added comment #${issue.comments.at(-1).id} to issue #${issue.id}.`)
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
            if (removed) log_success(`Deleted comment #${removed.id} from issue #${id}: ${removed.text}`)
            return
        }
        log_error('Usage: comment add <id> "<text>" | comment delete <id> <commentId>')
    }
}

showWelcome()
console.log(color_muted('Type "help" for available commands.'))
async function askCommand() {
    console.log()
    const answer = await ask(theme.prompt())
    if (answer === null) return
    const [command, ...args] = answer.trim().split(/\s+/)
    const handler = commands[command.toLowerCase()]
    if (!handler) {
        log_error(`Unknown command "${command}". Type "help" to see commands.`)
    } else {
        const result = handler(args)
        if (result === false) return
        if (result instanceof Promise) await result
    }
    askCommand()
}
askCommand()
