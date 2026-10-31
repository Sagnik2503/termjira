const { color_logo } = require('./colors')

const LOGO = [
    "╔╦╗ ╔═╗ ╦═╗ ╔╦╗  ╦  ╦  ╦═╗ ╔═╗",
    " ║  ║╣  ╠╦╝ ║║║  ║  ║  ╠╦╝ ╠═╣",
    " ╩  ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩  ╩╚═ ╩ ╩",
]

function showWelcome() {
    LOGO.forEach(line => console.log(color_logo(line)))
    console.log()
}

module.exports = { LOGO, showWelcome }
