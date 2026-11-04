const { theme } = require('./theme')
const { format_help, resolve_width } = require('./format')

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
        ['filter [--status <status>] [--priority <priority>] [--title "<text>"] [--description "<text>"] [--label <label>]', "Filter issues; repeat --label to require every label"],
        ["sort [--by id|priority|status|created] [--order asc|desc]", "Sort issues"],
    ]],
]

function show_help() {
    console.log(theme.bold('Available commands'))
    console.log()
    console.log(format_help(HELP_SECTIONS, { width: resolve_width(process.stdout.columns) }))
}

module.exports = { HELP_SECTIONS, show_help }
