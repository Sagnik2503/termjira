import { describe, it, expect } from "vitest";
import { createTheme } from "../src/theme.js";

describe("createTheme", () => {
    it("returns plain text when disabled", () => {
        const theme = createTheme({ enabled: false });

        expect(theme.accent("x")).toBe("x");
        expect(theme.status("TODO")).toBe("○ TODO");
        expect(theme.priority("HIGH")).toBe("↑ HIGH");
        expect(theme.prompt()).toBe("tj ❯ ");
    });

    it("uses truecolor escapes when enabled", () => {
        const theme = createTheme({ enabled: true, trueColor: true });

        expect(theme.accent("x")).toBe("\x1b[38;2;76;154;255mx\x1b[39m");
    });

    it("falls back to 16-color escapes", () => {
        const theme = createTheme({ enabled: true });
        const painted = theme.accent("x");

        expect(painted).toContain("\x1b[");
        expect(painted).not.toContain("38;2;");
    });
});
