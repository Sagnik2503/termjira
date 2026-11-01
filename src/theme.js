const picocolors = require('picocolors')

const PALETTE = {
    accent: { rgb: [76, 154, 255], ansi: 'cyan' },
    muted: { rgb: [107, 114, 128], ansi: 'dim' },
    success: { rgb: [74, 222, 128], ansi: 'green' },
    warning: { rgb: [251, 191, 36], ansi: 'yellow' },
    danger: { rgb: [248, 113, 113], ansi: 'red' },
    info: { rgb: [96, 165, 250], ansi: 'blue' },
}

const STATUS = {
    TODO: { glyph: '○', tone: 'muted' },
    IN_PROGRESS: { glyph: '◐', tone: 'info' },
    CLOSED: { glyph: '✓', tone: 'success' },
}

const PRIORITY = {
    LOW: { glyph: '↓', tone: 'muted' },
    MEDIUM: { glyph: '→', tone: 'warning' },
    HIGH: { glyph: '↑', tone: 'danger' },
}

const ESC = '\x1b'

function rgb_painter([r, g, b]) {
    return text => `${ESC}[38;2;${r};${g};${b}m${text}${ESC}[39m`
}

function createTheme({ enabled = false, trueColor = false } = {}) {
    const pc = picocolors.createColors(enabled)
    const fallback = {
        accent: pc.cyan,
        muted: pc.dim,
        success: pc.green,
        warning: pc.yellow,
        danger: pc.red,
        info: pc.blue,
    }
    const tones = {}
    for (const name of Object.keys(PALETTE)) {
        tones[name] = !enabled
            ? text => String(text)
            : trueColor
                ? rgb_painter(PALETTE[name].rgb)
                : fallback[name]
    }
    const bold = enabled ? pc.bold : text => String(text)
    const dim = enabled ? pc.dim : text => String(text)
    const tone = name => tones[name] ?? (text => String(text))

    return {
        enabled,
        trueColor,
        bold,
        dim,
        accent: tones.accent,
        muted: tones.muted,
        success: tones.success,
        warning: tones.warning,
        danger: tones.danger,
        status(value) {
            const spec = STATUS[value]
            if (!spec) return String(value)
            return `${tone(spec.tone)(spec.glyph)} ${tone(spec.tone)(value)}`
        },
        priority(value) {
            const spec = PRIORITY[value]
            if (!spec) return String(value)
            return `${tone(spec.tone)(spec.glyph)} ${tone(spec.tone)(value)}`
        },
        rule(width) {
            return dim('─'.repeat(Math.max(0, width)))
        },
        prompt() {
            return `${tones.accent('tj ❯')} `
        },
    }
}

const COLOR_ON = (() => {
    if (process.env.FORCE_COLOR === '0' || process.env.NO_COLOR) return false
    return Boolean(process.stdout.isTTY) || process.env.FORCE_COLOR !== undefined
})()

const theme = createTheme({
    enabled: COLOR_ON,
    trueColor: COLOR_ON && /truecolor|24bit/i.test(process.env.COLORTERM ?? ''),
})

module.exports = { createTheme, theme, PALETTE, STATUS, PRIORITY }
