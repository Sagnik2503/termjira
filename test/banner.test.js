import { describe, it, expect, vi, afterEach } from "vitest";
import { LOGO, showWelcome } from "../src/banner.js";

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");

describe("showWelcome", () => {
    afterEach(() => vi.restoreAllMocks());

    it("prints the logo followed by a blank line", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        showWelcome();
        const printed = log.mock.calls.map(([line]) => stripAnsi(line ?? ""));
        expect(printed).toEqual([...LOGO, ""]);
    });
});
