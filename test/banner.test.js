import { describe, it, expect, vi, afterEach } from "vitest";
import { LOGO, TAGLINE, showWelcome } from "../src/banner.js";
import { version } from "../package.json";

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, "");

describe("showWelcome", () => {
    afterEach(() => vi.restoreAllMocks());

    it("prints the logo, tagline and version", () => {
        // Arrange
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        // Act
        showWelcome();

        // Assert
        const printed = log.mock.calls.map(([line]) => stripAnsi(line ?? ""));
        expect(printed).toEqual([...LOGO, "", `${TAGLINE}  v${version}`, ""]);
    });
});
