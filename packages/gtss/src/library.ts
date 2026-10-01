export type LibrarySource = {
  id: string;
  label: string;
  url: string;
};

export type LibraryBounds = {
  min: { lat: number; lon: number };
  max: { lat: number; lon: number };
};

export type LibraryEntry = {
  id: string;
  title: string;
  official?: boolean;
  source: string;
  url: string;
  "owner-email"?: string;
  "owner-url"?: string;
  "date-added"?: string;
  bounds?: LibraryBounds | null;
};

export function getLibrarySourceUrls(showDemo = false): LibrarySource[] {
  const sources: LibrarySource[] = [
    {
      id: "production",
      label: "Production library",
      url: "/data/production/gtss-library.json",
    },
  ];

  if (showDemo) {
    sources.push({
      id: "testing",
      label: "Testing library",
      url: "/data/testing/gtss-library.json",
    });
  }

  return sources;
}

export function resolveLibraryResourceUrl(sourceId: string, resourcePath?: string): string {
  if (!resourcePath) return "";
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;
  if (resourcePath.startsWith("/")) return resourcePath;

  const baseUrl = sourceId === "testing" ? "/data/testing" : "/data/production";
  const trimmed = resourcePath.replace(/^\.\//, "").replace(/^\//, "");
  return `${baseUrl}/${trimmed}`;
}

export function flattenLibraryEntries(data: unknown, sourceId = "production"): LibraryEntry[] {
  const library = (data as { gtssLibrary?: unknown[] } | null)?.gtssLibrary;
  if (!Array.isArray(library)) return [];

  return library.map((entry, index) => {
    const typedEntry = entry as Record<string, unknown> | undefined;
    const title =
      typeof typedEntry?.title === "string" ? typedEntry.title : `Library item ${index + 1}`;
    const url = resolveLibraryResourceUrl(
      sourceId,
      typeof typedEntry?.["gtss-url"] === "string" ? typedEntry["gtss-url"] : undefined,
    );

    return {
      id: `${sourceId}-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index}`,
      title,
      official: Boolean(typedEntry?.official),
      source: sourceId,
      url,
      "owner-email":
        typeof typedEntry?.["owner-email"] === "string"
          ? typedEntry["owner-email"]
          : typeof typedEntry?.ownerEmail === "string"
            ? typedEntry.ownerEmail
            : undefined,
      "owner-url":
        typeof typedEntry?.["owner-url"] === "string"
          ? typedEntry["owner-url"]
          : typeof typedEntry?.ownerUrl === "string"
            ? typedEntry.ownerUrl
            : undefined,
      "date-added":
        typeof typedEntry?.["date-added"] === "string"
          ? typedEntry["date-added"]
          : typeof typedEntry?.dateAdded === "string"
            ? typedEntry.dateAdded
            : undefined,
      bounds:
        typedEntry && typeof typedEntry.bounds === "object" && typedEntry.bounds
          ? (typedEntry.bounds as LibraryBounds)
          : null,
    };
  });
}
