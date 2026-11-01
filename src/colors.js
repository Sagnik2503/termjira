const { theme } = require('./theme')

function color_priority(priority) {
    return theme.priority(priority)
}

function color_status(status) {
    return theme.status(status)
}

function color_label(label) {
    return theme.muted(label)
}

function color_logo(text) {
    return theme.bold(theme.accent(text))
}

function color_command(text) {
    return theme.bold(theme.accent(text))
}

function color_help_header(text) {
    return theme.bold(text)
}

function color_muted(text) {
    return theme.muted(text)
}

function log_error(message) {
    console.log(theme.danger(`✗ ${message}`))
}

function log_warn(message) {
    console.log(theme.warning(`! ${message}`))
}

function log_success(message) {
    console.log(theme.success(`✓ ${message}`))
}

module.exports = { color_priority, color_status, color_label, color_logo, color_command, color_help_header, color_muted, log_error, log_warn, log_success }
