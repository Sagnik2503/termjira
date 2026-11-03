import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "termjira-cli-"));

afterAll(() => {
    rmSync(home, { recursive: true, force: true });
});

describe("create without a TTY", () => {
    it("runs the piped create flow, persists the issue, and exits cleanly", () => {
        const result = spawnSync(process.execPath, ["cli.js"], {
            cwd: process.cwd(),
            env: { ...process.env, TERMJIRA_HOME: home },
            input: "create\nPiped issue\nMade without a TTY\nTODO\nHIGH\nbug, ui\n",
            encoding: "utf8",
            timeout: 10000,
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(0);
        expect(result.stderr).not.toMatch(/^\s+at .+:\d+:\d+/m);

        const stored = JSON.parse(readFileSync(join(home, "issue_store.json"), "utf8"));
        expect(stored).toEqual([
            expect.objectContaining({
                title: "Piped issue",
                description: "Made without a TTY",
                status: "TODO",
                priority: "HIGH",
                labels: ["bug", "ui"],
            }),
        ]);
    });
});
