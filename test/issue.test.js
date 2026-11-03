import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the store at a throwaway directory before issue.js resolves its path.
const store_dir = mkdtempSync(join(tmpdir(), "termjira-test-"));
const result_dir = mkdtempSync(join(tmpdir(), "termjira-results-"));
process.env.TERMJIRA_HOME = store_dir;

const { create_issue, format_issue, format_row, sort_issues, add_comments, delete_comment, get_issue, delete_issue, show_issue, add_labels, remove_labels, edit_title, update_status, update_priority, issue_not_found } = await import("../src/issue.js");

afterAll(() => {
    rmSync(store_dir, { recursive: true, force: true });
    rmSync(result_dir, { recursive: true, force: true });
});

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");

describe("store location", () => {
    it("writes issues inside the configured termjira directory", () => {
        const issue = create_issue("Store location", "Checks the store file");

        expect(existsSync(join(store_dir, "issue_store.json"))).toBe(true);
        expect(JSON.parse(readFileSync(join(store_dir, "issue_store.json"), "utf8"))).toEqual([
            expect.objectContaining({ id: issue.id, title: "Store location" }),
        ]);

        delete_issue(issue.id);
    });

    it("defaults to ~/.termjira/issue_store.json", () => {
        const home = mkdtempSync(join(tmpdir(), "termjira-home-"));

        try {
            const env = { ...process.env, HOME: home };
            delete env.TERMJIRA_HOME;
            execFileSync(process.execPath, ["-e", "require('./src/issue').create_issue('Home default', 'Uses the home directory')"], {
                cwd: process.cwd(),
                env,
                encoding: "utf8",
            });

            const stored = JSON.parse(readFileSync(join(home, ".termjira", "issue_store.json"), "utf8"));
            expect(stored).toEqual([
                expect.objectContaining({ title: "Home default" }),
            ]);
        } finally {
            rmSync(home, { recursive: true, force: true });
        }
    });
});

let result_seq = 0;

// Runs the store in a child process so a failed load cannot leak into other tests.
function run_store_script(home, body) {
    const result_path = join(result_dir, `result-${result_seq++}.json`);
    const script = `
        const __path = ${JSON.stringify(result_path)};
        try {
            const __result = (() => { ${body} })();
            require("node:fs").writeFileSync(__path, JSON.stringify(__result ?? null));
        } catch (error) {
            require("node:fs").writeFileSync(__path, JSON.stringify({ __error: String(error && error.stack || error) }));
            process.exitCode = 1;
        }
    `;
    execFileSync(process.execPath, ["-e", script], {
        cwd: process.cwd(),
        env: { ...process.env, TERMJIRA_HOME: home },
        encoding: "utf8",
    });
    return JSON.parse(readFileSync(result_path, "utf8"));
}

describe("store hardening", () => {
    it("reads a missing store as an empty list", () => {
        const home = mkdtempSync(join(tmpdir(), "termjira-missing-"));

        try {
            expect(run_store_script(home, `
                const { count_issues } = require("./src/issue");
                return { count: count_issues() };
            `)).toEqual({ count: 0 });
        } finally {
            rmSync(home, { recursive: true, force: true });
        }
    });

    it("preserves a corrupt store, backs it up, and refuses to overwrite it", () => {
        const home = mkdtempSync(join(tmpdir(), "termjira-corrupt-"));
        const store_path = join(home, "issue_store.json");
        const corrupt = "{ this is not json";

        try {
            writeFileSync(store_path, corrupt);

            const result = run_store_script(home, `
                const { count_issues, create_issue } = require("./src/issue");
                return {
                    count: count_issues(),
                    created: create_issue("Should not save", "Corrupt store") ?? null,
                };
            `);

            expect(result.count).toBe(0);
            expect(result.created).toBeNull();
            expect(readFileSync(store_path, "utf8")).toBe(corrupt);

            const backups = readdirSync(home).filter(name => name.endsWith(".bak"));
            expect(backups).toHaveLength(1);
            expect(readFileSync(join(home, backups[0]), "utf8")).toBe(corrupt);
            expect(readdirSync(home).filter(name => name.endsWith(".tmp"))).toEqual([]);
        } finally {
            rmSync(home, { recursive: true, force: true });
        }
    });

    it("reports a failed save from every mutator and leaves the store unchanged", () => {
        const home = mkdtempSync(join(tmpdir(), "termjira-readonly-"));
        const store_path = join(home, "issue_store.json");
        const seed = [{
            id: 1,
            title: "Seed",
            description: "Seed issue",
            status: "TODO",
            priority: "MEDIUM",
            labels: ["old"],
            comments: [{ id: 1, text: "hello" }],
            created_timestamp: 1,
            updated_timestamp: 1,
        }];

        try {
            writeFileSync(store_path, JSON.stringify(seed, null, 2));

            const result = run_store_script(home, `
                const fs = require("node:fs");
                const { create_issue, edit_title, edit_description, update_status,
                    update_priority, add_labels, remove_labels, delete_issue,
                    add_comments, delete_comment } = require("./src/issue");
                fs.chmodSync(${JSON.stringify(home)}, 0o555);
                try {
                    return {
                        create_issue: create_issue("New", "New issue") ?? null,
                        edit_title: edit_title(1, "New title") ?? null,
                        edit_description: edit_description(1, "New description") ?? null,
                        update_status: update_status(1, "CLOSED") ?? null,
                        update_priority: update_priority(1, "HIGH") ?? null,
                        add_labels: add_labels(1, ["new"]) ?? null,
                        remove_labels: remove_labels(1, ["old"]) ?? null,
                        delete_issue: delete_issue(1) ?? null,
                        add_comments: add_comments(1, "new comment") ?? null,
                        delete_comment: delete_comment(1, 1) ?? null,
                    };
                } finally {
                    fs.chmodSync(${JSON.stringify(home)}, 0o755);
                }
            `);

            for (const value of Object.values(result)) expect(value).toBeNull();
            expect(JSON.parse(readFileSync(store_path, "utf8"))).toEqual(seed);
        } finally {
            chmodSync(home, 0o755);
            rmSync(home, { recursive: true, force: true });
        }
    });

    it("leaves a valid store and no temp file after a successful save", () => {
        const issue = create_issue("Atomic save", "Successful write");

        try {
            expect(get_issue(issue.id)).toMatchObject({ title: "Atomic save" });
            expect(JSON.parse(readFileSync(join(store_dir, "issue_store.json"), "utf8")))
                .toEqual(expect.arrayContaining([expect.objectContaining({ id: issue.id })]));
            expect(readdirSync(store_dir).filter(name => name.endsWith(".tmp"))).toEqual([]);
        } finally {
            delete_issue(issue.id);
        }
    });

    it("prints a friendly error when the store directory cannot be created", () => {
        const home = mkdtempSync(join(tmpdir(), "termjira-blocked-"));
        const blocker = join(home, "not-a-directory");

        try {
            writeFileSync(blocker, "");

            const output = execFileSync(process.execPath, ["-e", "require('./src/issue').count_issues()"], {
                cwd: process.cwd(),
                env: { ...process.env, TERMJIRA_HOME: join(blocker, "store") },
                encoding: "utf8",
            });

            expect(output).toContain("Could not create the issue store");
        } finally {
            rmSync(home, { recursive: true, force: true });
        }
    });
});

const MESSAGE_GLYPHS = { success: "✓", warning: "!", error: "✗" };
const MISSING_ID = 987654321;
const missing_copy = `✗ Issue #${MISSING_ID} not found. Try "list" to see valid IDs.`;

function printed_lines(log) {
    return log.mock.calls.map(([line]) => stripAnsi(line));
}

describe("create_issue", () => {
    it("defaults status and priority and normalizes labels", async () => {
        const issue = await create_issue("Fix login", "Login is broken", undefined, undefined, "Bug, bug, UI");

        expect(issue.status).toBe("TODO");
        expect(issue.priority).toBe("MEDIUM");
        expect(issue.labels).toEqual(["bug", "ui"]);
    });
});

describe("comments", () => {
    afterEach(() => vi.restoreAllMocks());

    it("adds comments with sequential ids and trims the text", () => {
        const issue = create_issue("Comment add", "Issue for comment tests");

        add_comments(issue.id, "  first  ");
        const updated = add_comments(issue.id, "second");

        expect(updated.comments).toEqual([
            { id: 1, text: "first" },
            { id: 2, text: "second" },
        ]);

        delete_issue(issue.id);
    });

    it("rejects an empty comment", () => {
        const issue = create_issue("Comment empty", "Issue for comment tests");
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(add_comments(issue.id, "   ")).toBeUndefined();
        expect(log).toHaveBeenCalled();
        expect(get_issue(issue.id).comments).toEqual([]);

        delete_issue(issue.id);
    });

    it("rejects a comment on an unknown issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(add_comments(999999, "hello")).toBeUndefined();
        expect(log).toHaveBeenCalled();
    });

    it("deletes a comment by id and keeps the other ids stable", () => {
        const issue = create_issue("Comment delete", "Issue for comment tests");
        add_comments(issue.id, "first");
        add_comments(issue.id, "second");
        add_comments(issue.id, "third");

        const removed = delete_comment(issue.id, 2);

        expect(removed).toEqual({ id: 2, text: "second" });
        expect(get_issue(issue.id).comments).toEqual([
            { id: 1, text: "first" },
            { id: 3, text: "third" },
        ]);

        delete_issue(issue.id);
    });

    it("rejects deleting a comment from an unknown issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(delete_comment(999999, 1)).toBeUndefined();
        expect(log).toHaveBeenCalled();
    });

    it("rejects deleting an unknown comment id", () => {
        const issue = create_issue("Comment missing", "Issue for comment tests");
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(delete_comment(issue.id, 99)).toBeUndefined();
        expect(log).toHaveBeenCalled();
        expect(get_issue(issue.id).comments).toEqual([]);

        delete_issue(issue.id);
    });
});

describe("format_issue comments", () => {
    const base = { id: 7, title: "Fix login", description: "Bug", status: "TODO", priority: "HIGH", labels: [], created_timestamp: 0, updated_timestamp: 0 };

    it("renders comments below the card with their ids", () => {
        const output = stripAnsi(format_issue({ ...base, comments: [{ id: 1, text: "first" }, { id: 2, text: "second" }] }, { width: 80, now: 0 }));

        expect(output).toContain("#1 first");
        expect(output).toContain("#2 second");
    });

    it("omits the comments section when there are no comments", () => {
        expect(stripAnsi(format_issue({ ...base, comments: [] }, { width: 80, now: 0 }))).not.toContain("Comments");
    });
});

const issues = [
    { id: 3, priority: "LOW", status: "CLOSED", created_timestamp: 300 },
    { id: 1, priority: "HIGH", status: "TODO", created_timestamp: 100 },
    { id: 2, priority: "MEDIUM", status: "IN_PROGRESS", created_timestamp: 200 },
];

describe("sort_issues", () => {
    it("sorts by id ascending by default", () => {
        expect(sort_issues(undefined, undefined, issues).map(i => i.id)).toEqual([1, 2, 3]);
    });

    it("sorts priority semantically, not alphabetically", () => {
        expect(sort_issues("priority", "asc", issues).map(i => i.priority)).toEqual(["LOW", "MEDIUM", "HIGH"]);
        expect(sort_issues("priority", "desc", issues).map(i => i.priority)).toEqual(["HIGH", "MEDIUM", "LOW"]);
    });

    it("sorts status by workflow order", () => {
        expect(sort_issues("status", "asc", issues).map(i => i.status)).toEqual(["TODO", "IN_PROGRESS", "CLOSED"]);
    });

    it("sorts by created timestamp", () => {
        expect(sort_issues("created", "asc", issues).map(i => i.id)).toEqual([1, 2, 3]);
        expect(sort_issues("created", "desc", issues).map(i => i.id)).toEqual([3, 2, 1]);
    });

    it("breaks ties by id ascending", () => {
        const tied = [
            { id: 4, priority: "HIGH", status: "TODO", created_timestamp: 1 },
            { id: 2, priority: "HIGH", status: "TODO", created_timestamp: 1 },
        ];
        expect(sort_issues("priority", "desc", tied).map(i => i.id)).toEqual([2, 4]);
    });

    it("rejects invalid fields and orders, including uppercase", () => {
        expect(sort_issues("foo", "asc", issues)).toBeNull();
        expect(sort_issues("priority", "sideways", issues)).toBeNull();
        expect(sort_issues("Priority", "asc", issues)).toBeNull();
        expect(sort_issues("priority", "ASC", issues)).toBeNull();
    });
});

describe("format_row", () => {
    const issue = { id: 7, title: "Fix login", status: "TODO", priority: "HIGH", labels: ["bug"], created_timestamp: 0, updated_timestamp: 0 };

    it("renders the responsive table row", () => {
        const row = stripAnsi(format_row(issue, { width: 120, now: 0 }));

        expect(row).toContain("#7");
        expect(row).toContain("Fix login");
        expect(row).toContain("↑ HIGH");
        expect(row).toContain("bug");
    });
});

describe("issue_not_found", () => {
    afterEach(() => vi.restoreAllMocks());

    it("prints the friendly not-found copy with the error glyph", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        issue_not_found(MISSING_ID);

        expect(printed_lines(log)[0]).toBe(missing_copy);
    });
});

describe("friendly feedback for unknown issues", () => {
    afterEach(() => vi.restoreAllMocks());

    it("show_issue reports the missing issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        show_issue(MISSING_ID);

        expect(printed_lines(log)[0]).toBe(missing_copy);
    });

    it("delete_issue reports the missing issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(delete_issue(MISSING_ID)).toBeUndefined();
        expect(printed_lines(log)[0]).toBe(missing_copy);
    });

    it("comment add and delete report the missing issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(add_comments(MISSING_ID, "hello")).toBeUndefined();
        expect(delete_comment(MISSING_ID, 1)).toBeUndefined();

        expect(printed_lines(log)).toEqual([missing_copy, missing_copy]);
    });

    it("edit, status and priority report the missing issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(edit_title(MISSING_ID, "new title")).toBeUndefined();
        expect(update_status(MISSING_ID, "TODO")).toBeUndefined();
        expect(update_priority(MISSING_ID, "LOW")).toBeUndefined();

        expect(printed_lines(log)).toEqual([missing_copy, missing_copy, missing_copy]);
    });

    it("label add and remove report the missing issue", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        expect(add_labels(MISSING_ID, ["bug"])).toBeUndefined();
        expect(remove_labels(MISSING_ID, ["bug"])).toBeUndefined();

        expect(printed_lines(log)).toEqual([missing_copy, missing_copy]);
    });
});

describe("label feedback", () => {
    afterEach(() => vi.restoreAllMocks());

    it("warns on an existing label and succeeds on a new one", () => {
        const issue = create_issue("Label feedback add", "Issue for label tests", undefined, undefined, ["seed"]);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        add_labels(issue.id, ["seed", "extra"]);

        expect(printed_lines(log)).toEqual([
            `! Issue #${issue.id} already has label "seed".`,
            `✓ Added "extra" to issue #${issue.id}.`,
        ]);

        delete_issue(issue.id);
    });

    it("warns on a missing label and succeeds on an existing one", () => {
        const issue = create_issue("Label feedback remove", "Issue for label tests", undefined, undefined, ["keep"]);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        remove_labels(issue.id, ["keep", "ghost"]);

        expect(printed_lines(log)).toEqual([
            `✓ Removed "keep" from issue #${issue.id}.`,
            `! Issue #${issue.id} does not have label "ghost".`,
        ]);

        delete_issue(issue.id);
    });
});
