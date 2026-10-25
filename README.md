# TermJira

A command-line issue tracking tool inspired by Jira, built with JavaScript and Node.js.

## Features

- Create and manage issues.
- List all issues.
- View individual issue details.
- Check out a ticket and work within its context.
- Update issue status and priority.
- Track issues through a simple workflow: `TODO`, `IN_PROGRESS`, and `DONE`.

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
| `create` | Create a new issue |
| `list` | List all issues |
| `show <id>` | View issue details |
| `checkout <id>` | Open a ticket context |
| `status <status>` | Update the checked-out ticket's status |
| `priority <priority>` | Update the checked-out ticket's priority |
| `exit` | Exit the current context or application |

*Commands are being implemented incrementally; availability depends on the current development stage.*

## Project Goal

Build a practical, Jira-inspired issue tracker while learning JavaScript and Node.js through hands-on development.

The project will evolve from a basic CLI into a more complete issue tracking system, with persistent storage, projects, sprints, and potential AI-powered features in later stages.

## Status

🚧 Under active development.