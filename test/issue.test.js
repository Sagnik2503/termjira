import { describe, it, expect } from "vitest";
import { create_issue, format_row, sort_issues } from "../src/issue.js";

describe("create_issue", () => {
    it("defaults status and priority and normalizes labels", async () => {
        const issue = await create_issue("Fix login", "Login is broken", undefined, undefined, "Bug, bug, UI");

        expect(issue.status).toBe("TODO");
        expect(issue.priority).toBe("MEDIUM");
        expect(issue.labels).toEqual(["bug", "ui"]);
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
    const issue = { id: 7, title: "Fix login", status: "TODO", priority: "HIGH", labels: ["bug"], created_timestamp: 0 };

    it("renders a compact row without the created date by default", () => {
        expect(format_row(issue)).toBe("#7 | Fix login | Status: TODO | Priority: HIGH | Labels: bug");
    });

    it("appends a local date when asked", () => {
        expect(format_row(issue, true)).toBe(`#7 | Fix login | Status: TODO | Priority: HIGH | Labels: bug | Created: ${new Date(0).toLocaleDateString()}`);
    });
});
