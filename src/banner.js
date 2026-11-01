const { color_logo, color_muted } = require('./colors')
const { version } = require('../package.json')

const LOGO = [
    "╔╦╗ ╔═╗ ╦═╗ ╔╦╗  ╦  ╦  ╦═╗ ╔═╗",
    " ║  ║╣  ╠╦╝ ║║║  ║  ║  ╠╦╝ ╠═╣",
    " ╩  ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩  ╩╚═ ╩ ╩",
]

const TAGLINE = 'Issue tracking, in your terminal'

function showWelcome() {
    LOGO.forEach(line => console.log(color_logo(line)))
    console.log()
    console.log(`${color_muted(TAGLINE)}  ${color_muted(`v${version}`)}`)
    console.log()
}

module.exports = { LOGO, TAGLINE, showWelcome }
