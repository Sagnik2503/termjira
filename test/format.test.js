import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import {
    format_relative_time,
    truncate,
    wrap,
    resolve_width,
    visible_length,
    format_row,
    format_list,
    format_issue,
    format_comments,
    format_help,
    strip_control,
} from "../src/format.js";
import { HELP_SECTIONS } from "../src/help.js";

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");
const ANSI_ALL = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const graphemesOf = text => Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    part => part.segment,
);
const hasLoneSurrogate = text => {
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = text.charCodeAt(i + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
            i += 1;
        } else if (code >= 0xdc00 && code <= 0xdfff) {
            return true;
        }
    }
    return false;
};

function run_node(script, env) {
    const child_env = { ...process.env };
    delete child_env.NO_COLOR;
    delete child_env.FORCE_COLOR;
    Object.assign(child_env, env);
    return execFileSync(process.execPath, ["-e", script], {
        cwd: process.cwd(),
        env: child_env,
        encoding: "utf8",
    });
}

describe("format_relative_time", () => {
    const now = 1_000_000_000;

    it("formats minutes, hours and days", () => {
        expect(format_relative_time(now, now)).toBe("just now");
        expect(format_relative_time(now - 5 * 60000, now)).toBe("5m ago");
        expect(format_relative_time(now - 3 * 3600000, now)).toBe("3h ago");
        expect(format_relative_time(now - 2 * 86400000, now)).toBe("2d ago");
    });
});

describe("truncate", () => {
    it("adds an ellipsis when too long", () => {
        expect(truncate("abcdef", 4)).toBe("abc…");
    });

    it("leaves short text alone", () => {
        expect(truncate("abc", 4)).toBe("abc");
    });

    it("preserves complete escape sequences when truncating colored text", () => {
        const painted = `\x1b[31m${"x".repeat(40)}\x1b[39m`;
        const out = truncate(painted, 10);

        expect(visible_length(out)).toBe(10);
        expect(out.replace(ANSI_ALL, "")).toBe(`${"x".repeat(9)}…`);
        expect(out.replace(ANSI_ALL, "")).not.toContain("\x1b");
        expect(out).toContain("\x1b[31m");
        expect(out.endsWith("\x1b[0m")).toBe(true);
    });
});

describe("wrap", () => {
    it("breaks on word boundaries", () => {
        expect(wrap("one two three", 7)).toEqual(["one two", "three"]);
    });

    it("hard-splits words longer than the width", () => {
        const lines = wrap("A".repeat(25), 10);

        expect(lines).toEqual(["A".repeat(10), "A".repeat(10), "A".repeat(5)]);
        expect(lines.every(line => line.length <= 10)).toBe(true);
    });
});

describe("resolve_width", () => {
    it("clamps to 60-160 and falls back to 100", () => {
        expect(resolve_width(undefined)).toBe(100);
        expect(resolve_width(40)).toBe(60);
        expect(resolve_width(500)).toBe(160);
    });
});

const issue = {
    id: 7,
    title: "Fix login",
    status: "TODO",
    priority: "HIGH",
    labels: ["bug"],
    created_timestamp: 0,
    updated_timestamp: 0,
};

describe("format_row", () => {
    it("shows every column on a wide terminal", () => {
        const row = stripAnsi(format_row(issue, { width: 120, now: 0 }));

        expect(row).toContain("#7");
        expect(row).toContain("↑ HIGH");
        expect(row).toContain("○ TODO");
        expect(row).toContain("Fix login");
        expect(row).toContain("bug");
        expect(row).toContain("just now");
    });

    it("drops labels below 100 columns and timestamps below 80", () => {
        expect(stripAnsi(format_row(issue, { width: 90, now: 0 }))).not.toContain("bug");
        expect(stripAnsi(format_row(issue, { width: 70, now: 0 }))).not.toContain("just now");
    });

    it("truncates a long title to the available column", () => {
        const row = stripAnsi(format_row({ ...issue, title: "A".repeat(200) }, { width: 60, now: 0 }));

        expect(row).toContain("…");
        expect(row.length).toBeLessThanOrEqual(60);
    });

    it.each([60, 80, 100])("never exceeds %i columns with wide ids or unknown values", width => {
        const odd = {
            ...issue,
            id: 987654321,
            status: "SOME_VERY_LONG_STATUS",
            priority: "SOME_VERY_LONG_PRIORITY",
        };
        const row = format_row(odd, { width, now: 0 });

        expect(visible_length(row)).toBeLessThanOrEqual(width);
    });
});

describe("format_list", () => {
    it("prints a context line, a rule and a header", () => {
        const out = stripAnsi(format_list([issue], { width: 100, context: "Issues · 1", now: 0 }));

        expect(out.split("\n")[0]).toBe("Issues · 1");
        expect(out).toContain("─");
        expect(out).toContain("PRIORITY");
        expect(out).toContain("STATUS");
    });

    it.each([60, 80, 100])("keeps a long context line within %i columns", width => {
        const context = '5 matches · status=TODO · priority=HIGH · title~"login page broken" · description~"session expiry" · labels=bug+auth';
        const lines = stripAnsi(format_list([issue], { width, context, now: 0 })).split("\n");

        expect(lines[0].length).toBeLessThanOrEqual(width);
        expect(lines[0].startsWith("5 matches")).toBe(true);
        expect(lines[0]).toContain("…");
    });
});

describe("format_issue", () => {
    const detail = {
        id: 7,
        title: "Fix login",
        description: "Bug on expired sessions",
        status: "IN_PROGRESS",
        priority: "HIGH",
        labels: ["bug"],
        comments: [{ id: 1, text: "first" }],
        created_timestamp: 0,
        updated_timestamp: 0,
    };

    const borderWidths = out => stripAnsi(out)
        .split("\n")
        .filter(line => /^[│╭╰]/.test(line))
        .map(line => line.length);

    it("renders a card with fields and comments below it", () => {
        const out = stripAnsi(format_issue(detail, { width: 80, now: 0 }));

        expect(out).toContain("#7");
        expect(out).toContain("◐ IN_PROGRESS");
        expect(out).toContain("↑ HIGH");
        expect(out).toContain("bug");
        expect(out).toContain("just now");
        expect(out).toContain("Comments (1)");
        expect(out).toContain("#1 first");
        expect(out.indexOf("Comments")).toBeGreaterThan(out.indexOf("╰"));
    });

    it.each([60, 80, 100])("keeps every card line %i columns wide", width => {
        expect(new Set(borderWidths(format_issue(detail, { width, now: 0 })))).toEqual(new Set([width]));
    });

    it("wraps or truncates long unbroken content without breaking the border", () => {
        const long = {
            ...detail,
            title: "A".repeat(200),
            description: "B".repeat(200),
            labels: ["c".repeat(100)],
        };
        const out = stripAnsi(format_issue(long, { width: 60, now: 0 }));

        expect(new Set(borderWidths(out))).toEqual(new Set([60]));
        expect(out).toContain("…");
    });

    it.each([60, 80, 100])("keeps the border intact with long field values at %i columns", width => {
        const odd = { ...detail, status: "S".repeat(100), priority: "P".repeat(100) };
        const lines = stripAnsi(format_issue(odd, { width, now: 0 })).split("\n");

        for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
    });

    it("omits the comments section when there are none", () => {
        expect(stripAnsi(format_issue({ ...detail, comments: [] }, { width: 80, now: 0 }))).not.toContain("Comments");
    });
});

describe("format_comments", () => {
    it("wraps long unbroken comment text to the terminal width", () => {
        const out = stripAnsi(format_comments([{ id: 12, text: "D".repeat(200) }], { width: 60 }));

        expect(out.split("\n").every(line => line.length <= 60)).toBe(true);
        expect(out).toContain("#12");
    });

    it("returns an empty string with no comments", () => {
        expect(format_comments([], { width: 60 })).toBe("");
    });
});

describe("format_help", () => {
    const titles = ["General", "Issues", "Labels", "Comments", "Search"];

    it("keeps the five familiar groups", () => {
        expect(HELP_SECTIONS.map(([title]) => title)).toEqual(titles);
    });

    it("renders every section with a rule and exactly one example", () => {
        const out = stripAnsi(format_help(HELP_SECTIONS, { width: 100 }));
        const lines = out.split("\n");

        for (const title of titles) {
            const start = lines.findIndex(line => line === title);
            expect(start).toBeGreaterThanOrEqual(0);
            expect(lines[start + 1]).toMatch(/^─+$/);
        }
        expect(lines.filter(line => line.includes("Try:")).length).toBe(titles.length);
    });

    it("aligns command and description columns", () => {
        const lines = stripAnsi(format_help(HELP_SECTIONS, { width: 100 })).split("\n");
        const help = lines.find(line => line.includes("Show available commands"));
        const exit = lines.find(line => line.includes("Exit TermJira"));

        expect(help.indexOf("Show")).toBe(exit.indexOf("Exit"));
    });

    it("falls back to two lines for long usages", () => {
        const out = stripAnsi(format_help(HELP_SECTIONS, { width: 100 }));

        expect(out).toContain("update <id> <title|description|status|priority> <value>");
        expect(out).toContain("Update an issue field");
    });

    it.each([60, 80, 100])("keeps every line within %i columns", width => {
        const lines = stripAnsi(format_help(HELP_SECTIONS, { width })).split("\n");

        for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
    });

    it.each([60, 80, 100])("lists every supported filter flag in Search at %i columns", width => {
        const lines = stripAnsi(format_help(HELP_SECTIONS, { width })).split("\n");
        const start = lines.indexOf("Search");
        const tryIndex = lines.findIndex((line, i) => i > start && line.includes("Try:"));
        const search = lines.slice(start, tryIndex).join(" ");

        expect(tryIndex).toBeGreaterThan(start);
        for (const flag of ["--status", "--priority", "--title", "--description", "--label"]) {
            expect(search).toContain(flag);
        }
        expect(search).toContain("repeat --label");
        expect(lines[tryIndex]).toContain("filter ");
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
    });
});

const width_issue = {
    id: 987654321,
    title: "A".repeat(200),
    description: "B".repeat(300),
    status: "IN_PROGRESS",
    priority: "HIGH",
    labels: ["c".repeat(100)],
    comments: [{ id: 12345, text: "D".repeat(300) }],
    created_timestamp: 0,
    updated_timestamp: 0,
};

const width_script = [
    "const {format_list,format_issue,format_comments,format_help}=require('./src/format');",
    "const {HELP_SECTIONS}=require('./src/help');",
    `const issue=${JSON.stringify(width_issue)};`,
    "const out={};",
    "for (const w of [60,80,100]) {",
    "  out['list@'+w]=format_list([issue],{width:w,now:0,context:'context '.repeat(30)});",
    "  out['issue@'+w]=format_issue(issue,{width:w,now:0});",
    "  out['comments@'+w]=format_comments(issue.comments,{width:w});",
    "  out['help@'+w]=format_help(HELP_SECTIONS,{width:w});",
    "}",
    "process.stdout.write(JSON.stringify(out));",
].join("\n");

describe("screen width safety", () => {
    it("keeps every line within 60, 80 and 100 columns with color on", () => {
        const out = JSON.parse(run_node(width_script, { FORCE_COLOR: "1" }));

        for (const line of Object.values(out)) expect(line).toContain("\x1b[");
        for (const [key, text] of Object.entries(out)) {
            const width = Number(key.split("@")[1]);
            for (const line of text.split("\n")) {
                expect(visible_length(line), `${key}: ${JSON.stringify(line)}`).toBeLessThanOrEqual(width);
            }
        }
    });

    it("emits no ANSI escapes when NO_COLOR is set", () => {
        const out = JSON.parse(run_node(width_script, { NO_COLOR: "1" }));

        for (const [key, text] of Object.entries(out)) {
            expect(text, key).not.toContain("\x1b");
        }
    });
});

describe("display width", () => {
    it("measures wide and emoji characters by display columns", () => {
        expect(visible_length("日本語")).toBe(6);
        expect(visible_length("😀")).toBe(2);
        expect(visible_length("a😀日")).toBe(5);
        expect(visible_length("\x1b[31m日本\x1b[39m")).toBe(4);
    });

    it("truncates emoji and CJK without splitting graphemes or producing lone surrogates", () => {
        const samples = ["😀😀😀😀😀", "日本語のタイトルです", "👨‍👩‍👧‍👦".repeat(4), "a😀日b"];

        for (const sample of samples) {
            const all = graphemesOf(sample);
            for (let width = 2; width < visible_length(sample); width += 1) {
                const out = truncate(sample, width);
                expect(out.endsWith("…"), `${sample} @ ${width}`).toBe(true);
                expect(visible_length(out), `${sample} @ ${width}`).toBeLessThanOrEqual(width);
                expect(hasLoneSurrogate(out), `${sample} @ ${width}`).toBe(false);
                const kept = graphemesOf(out.slice(0, -1));
                expect(kept).toEqual(all.slice(0, kept.length));
            }
        }
    });

    it("hard-splits wide words without exceeding the width", () => {
        const lines = wrap("日".repeat(10), 5);

        expect(lines.join("")).toBe("日".repeat(10));
        for (const line of lines) expect(visible_length(line)).toBeLessThanOrEqual(5);
    });
});

describe("wide character rendering", () => {
    const wide_issue = {
        ...issue,
        title: "日本語のタイトル".repeat(12),
        labels: ["ラベル", "😀絵文字"],
    };

    const wide_detail = {
        id: 7,
        title: "日本語のタイトル".repeat(12),
        description: `😀${"説明文".repeat(40)}`,
        status: "IN_PROGRESS",
        priority: "HIGH",
        labels: ["ラベル", "😀"],
        comments: [{ id: 1, text: "日本語のコメント".repeat(20) }],
        created_timestamp: 0,
        updated_timestamp: 0,
    };

    it.each([60, 80, 100])("keeps wide list rows within %i columns", width => {
        const row = stripAnsi(format_row(wide_issue, { width, now: 0 }));

        expect(visible_length(row)).toBeLessThanOrEqual(width);
    });

    it.each([60, 80, 100])("keeps wide card borders aligned at %i columns", width => {
        const lines = stripAnsi(format_issue(wide_detail, { width, now: 0 })).split("\n");

        for (const line of lines) expect(visible_length(line)).toBeLessThanOrEqual(width);
        const borders = lines.filter(line => /^[│╭╰]/.test(line));
        for (const line of borders) expect(visible_length(line)).toBe(width);
    });

    it.each([60, 80, 100])("keeps wide help lines within %i columns", width => {
        const sections = [[
            "検索",
            [
                ["filter --title <日本語>", "日本語の説明文を表示します。".repeat(6)],
                ["sort <日本語>", "説明😀".repeat(10)],
            ],
        ]];

        for (const line of stripAnsi(format_help(sections, { width })).split("\n")) {
            expect(visible_length(line)).toBeLessThanOrEqual(width);
        }
    });
});

describe("strip_control", () => {
    it("removes CSI, OSC and C0/C1 control sequences", () => {
        expect(strip_control("safe\x1b[2Jtitle")).toBe("safetitle");
        expect(strip_control("safe\x1b]0;pwned\x07title")).toBe("safetitle");
        expect(strip_control("a\x00\x07\x9bb")).toBe("ab");
        expect(strip_control("a\x1b(0b")).toBe("ab");
    });

    it("keeps ordinary text, emoji and CJK unchanged", () => {
        expect(strip_control("Fix 日本語 😀 login")).toBe("Fix 日本語 😀 login");
    });
});

describe("control-safe rendering", () => {
    const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/;
    const nasty = "safe\x1b[2Jtitle\x1b]0;pwned\x07\x00\x9b";

    it("removes control characters and escape sequences from user text", () => {
        const row = stripAnsi(format_row({ ...issue, title: nasty }, { width: 60, now: 0 }));
        expect(row).not.toMatch(CONTROL);
        expect(row).toContain("safetitle");

        const card = stripAnsi(format_issue({
            id: 1,
            title: nasty,
            description: nasty,
            status: "TODO",
            priority: "LOW",
            labels: [nasty],
            comments: [{ id: 1, text: nasty }],
            created_timestamp: 0,
            updated_timestamp: 0,
        }, { width: 60, now: 0 }));

        expect(card).not.toMatch(CONTROL);
        expect(card).toContain("safetitle");
    });

    it("does not count control characters as visible width", () => {
        expect(visible_length("a\x07b")).toBe(2);
    });

    it("removes escape codes from the filter context line", () => {
        const out = format_list([issue], {
            width: 100,
            now: 0,
            context: '1 match · title~"bad\x1b[2Jtitle"',
        });

        expect(out).not.toContain("\x1b[2J");
        expect(stripAnsi(out)).toContain('title~"badtitle"');
    });
});
