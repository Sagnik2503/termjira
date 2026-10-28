# TermJira

A command-line issue tracking tool inspired by Jira, built with JavaScript and Node.js.

## Features

- Create and manage issues.
- List all issues.
- View individual issue details.
- Update issue status and priority.
- Add, remove, list, and filter by labels.
- Track issues through a simple workflow: `TODO`, `IN_PROGRESS`, and `CLOSED`.

## Tech Stack

- JavaScript
- Node.js
- Node.js built-in modules

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine.

### Run the project

1. Clone the repository.
2. Navigate to the project directory.
3. Run:

   ```bash
   npm start
   ```

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
| `filter [--status <status>] [--priority <priority>] [--title "<text>"] [--description "<text>"] [--label <label>]` | Filter issues; repeat `--label` to require every label |
| `sort [--by id\|priority\|status\|created] [--order asc\|desc]` | Sort issues; defaults to `id` ascending |
| `exit` | Exit TermJira |

*Commands are being implemented incrementally; availability depends on the current development stage.*

## Project Goal

Build a practical, Jira-inspired issue tracker while learning JavaScript and Node.js through hands-on development.

The project will evolve from a basic CLI into a more complete issue tracking system, with persistent storage, projects, sprints, and potential AI-powered features in later stages.

## Status

🚧 Under active development.