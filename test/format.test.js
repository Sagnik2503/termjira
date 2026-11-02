import { describe, it, expect } from "vitest";
import {
    format_relative_time,
    truncate,
    wrap,
    resolve_width,
    format_row,
    format_list,
    format_help,
} from "../src/format.js";

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");

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
});

describe("wrap", () => {
    it("breaks on word boundaries", () => {
        expect(wrap("one two three", 7)).toEqual(["one two", "three"]);
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
});

describe("format_list", () => {
    it("prints a context line, a rule and a header", () => {
        const out = stripAnsi(format_list([issue], { width: 100, context: "Issues · 1", now: 0 }));

        expect(out.split("\n")[0]).toBe("Issues · 1");
        expect(out).toContain("─");
        expect(out).toContain("PRIORITY");
        expect(out).toContain("STATUS");
    });
});

import { HELP_SECTIONS } from "../src/help.js";

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
});
