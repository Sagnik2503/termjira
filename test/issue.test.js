import { describe, it, expect, vi, afterEach } from "vitest";
import { create_issue, format_issue, format_row, sort_issues, add_comments, delete_comment, get_issue, delete_issue, show_issue, add_labels, remove_labels, edit_title, update_status, update_priority, issue_not_found } from "../src/issue.js";

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");

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
