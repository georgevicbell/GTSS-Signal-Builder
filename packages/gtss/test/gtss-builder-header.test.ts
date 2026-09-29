import { describe, expect, it } from "vitest";
import { shouldShowHeaderActions } from "../src/headerConfig";

describe("GTSS builder header actions", () => {
    it("hides add buttons while the configuration panel is open", () => {
        expect(
            shouldShowHeaderActions({
                showExportPanel: false,
                showImportPanel: false,
                showAgencyDefaults: true,
            }),
        ).toBe(false);
    });

    it("shows add buttons for normal tab views", () => {
        expect(
            shouldShowHeaderActions({
                showExportPanel: false,
                showImportPanel: false,
                showAgencyDefaults: false,
            }),
        ).toBe(true);
    });
});
