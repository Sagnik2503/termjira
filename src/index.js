const readline = require('readline')
const prompt = require("prompt-sync")()
const { create_issue, list_issues, show_issue } = require('./issue')

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
    console.log("show - show particular issue ID");
    console.log("exit - Exit TermJira");
}

showWelcome()
function askCommand() {

    rl.question('tj> ', (answer) => {
        if (answer.toLowerCase() === "help") {
            showHelp()
        }
        else if (answer.toLowerCase() === "list") {
            list_issues()
        }
        else if (answer.startsWith("show ")) {
            const parts = answer.split(" ")
            const issue_id = Number(parts[1])
            show_issue(issue_id)
        }
        else if (answer.toLowerCase() === "create") {

            const title = prompt("Title for the issue: ");
            const description = prompt("Description for the issue: ");
            const status = prompt("Status for the issue: ");
            const priority = prompt("Priority for the issue: ");
            const issue = create_issue(title, description, status, priority);
            console.log(`tj> Issue created! ID: ${issue.id}`);
        }
        else if (answer === "exit") {
            console.log("Goodbye!")
            rl.close()
            return
        }
        else {
            console.log("unknown command")
        }

        askCommand()
    })
}
askCommand()
