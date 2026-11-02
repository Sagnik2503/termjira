function filter_context(count, flags = {}) {
    const filters = []
    if (flags.status) filters.push(`status=${flags.status}`)
    if (flags.priority) filters.push(`priority=${flags.priority}`)
    if (flags.title) filters.push(`title~"${flags.title}"`)
    if (flags.description) filters.push(`description~"${flags.description}"`)
    if (flags.label?.length) filters.push(`labels=${flags.label.join('+')}`)
    const noun = `match${count === 1 ? '' : 'es'}`
    return `${count} ${noun}${filters.length ? ` · ${filters.join(' · ')}` : ''}`
}

function sort_context(count, by = 'id', order = 'asc') {
    return `${count} issue${count === 1 ? '' : 's'} · sorted by ${by} ${order}`
}

module.exports = { filter_context, sort_context }
