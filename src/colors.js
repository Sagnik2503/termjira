const picocolors = require('picocolors')

const pc = picocolors.createColors(process.stdout.isTTY && !process.env.NO_COLOR && process.env.FORCE_COLOR !== '0')

const PRIORITY_COLORS = {
    HIGH: value => pc.bold(pc.red(value)),
    MEDIUM: pc.yellow,
    LOW: pc.green,
}

const STATUS_COLORS = {
    TODO: pc.dim,
    IN_PROGRESS: pc.cyan,
    CLOSED: pc.green,
}

function color_priority(priority) {
    return (PRIORITY_COLORS[priority] ?? String)(priority)
}

function color_status(status) {
    return (STATUS_COLORS[status] ?? String)(status)
}

function color_label(label) {
    return pc.cyan(label)
}

function log_error(message) {
    console.log(pc.red(message))
}

module.exports = { color_priority, color_status, color_label, log_error }
