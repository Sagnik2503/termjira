const { theme } = require('./theme')

const ANSI = /\x1b\[[0-9;]*m/g

const visible_length = text => String(text).replace(ANSI, '').length

const pad = (text, width) => text + ' '.repeat(Math.max(0, width - visible_length(text)))

function truncate(text, width) {
    const value = String(text)
    if (visible_length(value) <= width) return value
    if (width <= 1) return '…'.slice(0, width)
    return `${value.slice(0, width - 1)}…`
}

function resolve_width(width = process.stdout.columns) {
    const value = Number(width)
    return Math.max(60, Math.min(160, Number.isFinite(value) && value > 0 ? value : 100))
}

function format_relative_time(timestamp, now = Date.now()) {
    const value = Number(timestamp ?? now)
    const diff = Math.max(0, now - value)
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function format_absolute_time(timestamp) {
    return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function wrap(text, width) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean)
    if (words.length === 0) return ['']
    const lines = []
    let line = ''
    for (const word of words) {
        // shortcut: a word longer than width is not split; fine for titles and descriptions
        if (!line) line = word
        else if (line.length + 1 + word.length <= width) line += ` ${word}`
        else {
            lines.push(line)
            line = word
        }
    }
    lines.push(line)
    return lines
}

const LIST_COLUMNS = { id: 5, priority: 8, status: 13, labels: 20, updated: 8 }

function list_layout(width) {
    const cols = resolve_width(width)
    const showLabels = cols >= 100
    const showUpdated = cols >= 80
    const fixed = LIST_COLUMNS.id + LIST_COLUMNS.priority + LIST_COLUMNS.status
        + (showLabels ? LIST_COLUMNS.labels : 0)
        + (showUpdated ? LIST_COLUMNS.updated : 0)
        + 2 * (3 + (showLabels ? 1 : 0) + (showUpdated ? 1 : 0))
    return { cols, showLabels, showUpdated, title: Math.max(10, cols - fixed) }
}

function format_list_header(layout) {
    const cells = [
        pad('ID', LIST_COLUMNS.id),
        pad('PRIORITY', LIST_COLUMNS.priority),
        pad('STATUS', LIST_COLUMNS.status),
        pad('TITLE', layout.title),
    ]
    if (layout.showLabels) cells.push(pad('LABELS', LIST_COLUMNS.labels))
    if (layout.showUpdated) cells.push('UPDATED')
    return theme.muted(cells.join('  ').trimEnd())
}

function format_row(issue, { width, now = Date.now() } = {}) {
    const layout = list_layout(width)
    const cells = [
        theme.muted(pad(`#${issue.id}`, LIST_COLUMNS.id)),
        pad(theme.priority(issue.priority), LIST_COLUMNS.priority),
        pad(theme.status(issue.status), LIST_COLUMNS.status),
        pad(truncate(issue.title, layout.title), layout.title),
    ]
    if (layout.showLabels) {
        const labels = issue.labels?.length ? issue.labels.join(', ') : '—'
        cells.push(pad(theme.muted(truncate(labels, LIST_COLUMNS.labels)), LIST_COLUMNS.labels))
    }
    if (layout.showUpdated) {
        cells.push(theme.muted(format_relative_time(issue.updated_timestamp ?? issue.created_timestamp, now)))
    }
    return cells.join('  ').trimEnd()
}

function format_list(issues, { width, now = Date.now(), context } = {}) {
    const layout = list_layout(width)
    return [
        theme.bold(context ?? `Issues · ${issues.length}`),
        theme.rule(layout.cols),
        format_list_header(layout),
        ...issues.map(issue => format_row(issue, { width: layout.cols, now })),
    ].join('\n')
}

const HELP_USAGE_MAX = 40

function format_help(sections, { width } = {}) {
    const cols = resolve_width(width)
    const longest = Math.max(0, ...sections.flatMap(([, rows]) => rows.map(([usage]) => usage.length)))
    const usageWidth = Math.max(1, Math.min(cols - 30, HELP_USAGE_MAX, longest))
    const out = []
    for (const [title, rows] of sections) {
        out.push(theme.bold(title))
        out.push(theme.rule(cols))
        for (const [usage, description] of rows) {
            if (usage.length > usageWidth) {
                for (const line of wrap(usage, Math.max(10, cols - 2))) out.push(`  ${theme.accent(line)}`)
                for (const line of wrap(description, Math.max(10, cols - 4))) out.push(`    ${theme.muted(line)}`)
            } else {
                const descColumn = usageWidth + 4
                const wrapped = wrap(description, Math.max(1, cols - descColumn))
                out.push(`  ${theme.accent(pad(usage, usageWidth))}  ${theme.muted(wrapped[0])}`)
                for (const line of wrapped.slice(1)) out.push(`${' '.repeat(descColumn)}${theme.muted(line)}`)
            }
        }
        out.push(`  ${theme.muted('Try:')} ${theme.accent(truncate(rows[0][0], Math.max(1, cols - 8)))}`)
        out.push('')
    }
    return out.join('\n').trimEnd()
}

module.exports = { visible_length, pad, truncate, resolve_width, format_relative_time, format_absolute_time, wrap, format_row, format_list, format_help }
