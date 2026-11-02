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
    const cols = Math.max(1, Math.floor(width))
    const lines = []
    let line = ''
    for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
        let rest = word
        if (line && line.length + 1 + rest.length <= cols) {
            line += ` ${rest}`
            continue
        }
        if (line) {
            lines.push(line)
            line = ''
        }
        while (rest.length > cols) {
            lines.push(rest.slice(0, cols))
            rest = rest.slice(cols)
        }
        line = rest
    }
    if (line || lines.length === 0) lines.push(line)
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
        theme.bold(truncate(context ?? `Issues · ${issues.length}`, layout.cols)),
        theme.rule(layout.cols),
        format_list_header(layout),
        ...issues.map(issue => format_row(issue, { width: layout.cols, now })),
    ].join('\n')
}

function format_comments(comments, { width } = {}) {
    if (!comments?.length) return ''
    const cols = resolve_width(width)
    const lines = [theme.bold(`Comments (${comments.length})`), theme.rule(cols)]
    for (const comment of comments) {
        const prefix = `#${comment.id} `
        const wrapped = wrap(comment.text, Math.max(10, cols - prefix.length))
        lines.push(`${theme.muted(`#${comment.id}`)} ${wrapped[0]}`)
        for (const extra of wrapped.slice(1)) lines.push(`${' '.repeat(prefix.length)}${extra}`)
        lines.push('')
    }
    return lines.join('\n').trimEnd()
}

function format_issue(issue, { width, now = Date.now() } = {}) {
    const cols = resolve_width(width)
    const inner = cols - 4
    const content = text => `${theme.muted('│')} ${pad(text, inner)} ${theme.muted('│')}`
    const field = (label, value) => content(`${theme.muted(label.padEnd(10))}${value}`)
    const heading = `#${issue.id}`
    const top = `${theme.muted('╭─')} ${theme.bold(heading)} ${theme.muted(`${'─'.repeat(Math.max(0, cols - heading.length - 5))}╮`)}`
    const bottom = theme.muted(`╰${'─'.repeat(Math.max(0, cols - 2))}╯`)
    const plainLabels = issue.labels?.length ? issue.labels.join(', ') : '—'
    const labels = theme.muted(truncate(plainLabels, inner - 10))
    const updated = issue.updated_timestamp ?? issue.created_timestamp

    const lines = [top]
    for (const line of wrap(issue.title, inner)) lines.push(content(theme.bold(line)))
    lines.push(content(''))
    for (const line of wrap(issue.description || '—', inner)) lines.push(content(line))
    lines.push(content(''))
    lines.push(field('Status', theme.status(issue.status)))
    lines.push(field('Priority', theme.priority(issue.priority)))
    lines.push(field('Labels', labels))
    lines.push(field('Created', `${theme.muted(format_relative_time(issue.created_timestamp, now))} ${theme.muted('·')} ${theme.muted(format_absolute_time(issue.created_timestamp))}`))
    lines.push(field('Updated', `${theme.muted(format_relative_time(updated, now))} ${theme.muted('·')} ${theme.muted(format_absolute_time(updated))}`))
    lines.push(bottom)

    const comments = format_comments(issue.comments ?? [], { width: cols })
    return comments ? `${lines.join('\n')}\n\n${comments}` : lines.join('\n')
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

module.exports = { visible_length, pad, truncate, resolve_width, format_relative_time, format_absolute_time, wrap, format_row, format_list, format_issue, format_comments, format_help }
