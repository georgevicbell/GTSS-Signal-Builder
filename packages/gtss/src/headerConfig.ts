export type HeaderActionState = {
    showExportPanel: boolean;
    showImportPanel: boolean;
    showAgencyDefaults: boolean;
};

export function shouldShowHeaderActions({
    showExportPanel,
    showImportPanel,
    showAgencyDefaults,
}: HeaderActionState): boolean {
    return !showExportPanel && !showImportPanel && !showAgencyDefaults;
}
