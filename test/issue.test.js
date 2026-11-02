import { describe, it, expect, vi, afterEach } from "vitest";
import { create_issue, format_issue, format_row, sort_issues, add_comments, delete_comment, get_issue, delete_issue } from "../src/issue.js";

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");

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
