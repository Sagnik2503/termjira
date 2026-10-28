import { describe, it, expect } from "vitest";
import { create_issue } from "../src/issue.js";

describe("create_issue", () => {
    it("defaults status and priority and normalizes labels", async () => {
        const issue = await create_issue("Fix login", "Login is broken", undefined, undefined, "Bug, bug, UI");

        expect(issue.status).toBe("TODO");
        expect(issue.priority).toBe("MEDIUM");
        expect(issue.labels).toEqual(["bug", "ui"]);
    });
});
