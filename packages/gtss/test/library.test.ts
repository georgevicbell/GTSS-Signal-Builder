import { describe, expect, it } from "vitest";
import { flattenLibraryEntries, getLibrarySourceUrls } from "../src/library";

describe("library source helpers", () => {
  it("exposes the production library by default and includes testing data in demo mode", () => {
    expect(getLibrarySourceUrls(false)).toEqual([
      { id: "production", label: "Production library", url: "/data/production/gtss-library.json" },
    ]);

    expect(getLibrarySourceUrls(true)).toEqual([
      { id: "production", label: "Production library", url: "/data/production/gtss-library.json" },
      { id: "testing", label: "Testing library", url: "/data/testing/gtss-library.json" },
    ]);
  });

  it("flattens all library entries and captures their bounds", () => {
    const entries = flattenLibraryEntries({
      gtssLibrary: [
        {
          title: "One",
          "gtss-url": "./gtssFiles/a.zip",
          bounds: { min: { lat: 1, lon: 2 }, max: { lat: 3, lon: 4 } },
        },
        {
          title: "Two",
          "gtss-url": "./gtssFiles/b.zip",
          bounds: { min: { lat: 5, lon: 6 }, max: { lat: 7, lon: 8 } },
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      title: "One",
      source: "production",
      url: "/data/production/gtssFiles/a.zip",
      bounds: { min: { lat: 1, lon: 2 }, max: { lat: 3, lon: 4 } },
    });
  });
});
