# TermJira

```text
╔╦╗ ╔═╗ ╦═╗ ╔╦╗  ╦  ╦  ╦═╗ ╔═╗
 ║  ║╣  ╠╦╝ ║║║  ║  ║  ╠╦╝ ╠═╣
 ╩  ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩  ╩╚═ ╩ ╩
```

A command-line issue tracking tool inspired by Jira, built with JavaScript and Node.js.

## Features

- Create and manage issues.
- List all issues.
- View individual issue details.
- Update issue status and priority.
- Add, remove, list, and filter by labels.
- Filter by status, priority, title, description, and labels.
- Sort by ID, priority, status, or creation time.
- Add and delete comments.
- Track issues through a simple workflow: `TODO`, `IN_PROGRESS`, and `CLOSED`.

## Tech Stack

- JavaScript
- Node.js 18 or later
- [picocolors](https://www.npmjs.com/package/picocolors) for terminal colors
- Node.js built-in modules (`fs`, `os`, `path`, `readline`)

## Installation

Install the published package globally:

```bash
npm install -g termjira
```

Then run it from anywhere:

```bash
termjira
```

## Store

TermJira keeps issues in `~/.termjira/issue_store.json`. To use a different location, set `TERMJIRA_HOME` to the directory that should hold the Store:

```bash
TERMJIRA_HOME=/path/to/data termjira
```

TermJira supports single-instance use. There is no cross-process locking, so do not run two sessions against the same Store at once; concurrent edits may be lost.

## Commands

| Command | Description |
|---|---|
| `help` | Display available commands |
| `create` | Create a new issue (prompts for title, description, status, priority, labels) |
| `list` | List all issues |
| `show <id>` | View an issue |
| `update <id> <title\|description\|status\|priority> <value>` | Update an issue field |
| `delete <id> [--force]` | Delete an issue (asks for confirmation unless `--force`) |
| `label list` | List all labels in use with issue counts |
| `label add <id> <label>[,<label>...]` | Add labels to an issue |
| `label remove <id> <label>[,<label>...]` | Remove labels from an issue |
| `comment add <id> "<text>"` | Add a comment to an issue (text must be quoted) |
| `comment delete <id> <commentId>` | Delete a comment from an issue |
| `filter [--status <status>] [--priority <priority>] [--title "<text>"] [--description "<text>"] [--label <label>]` | Filter issues; title and description values must be quoted, and repeat `--label` to require every label |
| `sort [--by id\|priority\|status\|created] [--order asc\|desc]` | Sort issues; defaults to `id` ascending |
| `exit` | Exit TermJira |

Status values are `TODO`, `IN_PROGRESS`, and `CLOSED`. Priority values are `LOW`, `MEDIUM`, and `HIGH`.

## License

ISC. See [LICENSE](LICENSE).
