import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const libraryFiles = [
  path.join(rootDir, "data", "production", "gtss-library.json"),
  path.join(rootDir, "data", "testing", "gtss-library.json"),
];

function parseCSVLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function extractSignalCoordinates(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const coords = [];
  for (const line of lines.slice(1)) {
    const values = parseCSVLine(line);
    if (values.length < 4) continue;

    const lat = Number(values[2]);
    const lon = Number(values[3]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      coords.push({ lat, lon });
    }
  }

  return coords;
}

async function updateBoundsForLibraryFile(libraryFilePath) {
  const raw = await fs.readFile(libraryFilePath, "utf8");
  const library = JSON.parse(raw);
  const items = Array.isArray(library.gtssLibrary) ? library.gtssLibrary : [];

  for (const item of items) {
    const gtssUrl = item["gtss-url"] || item["gtssUrl"];
    if (!gtssUrl) {
      item.bounds = null;
      continue;
    }

    const resourcePath = gtssUrl.startsWith("/") ? gtssUrl : path.resolve(path.dirname(libraryFilePath), gtssUrl);
    try {
      const zipData = await fs.readFile(resourcePath);
      const zip = await JSZip.loadAsync(zipData);
      const signalCoords = [];

      for (const [entryPath, entry] of Object.entries(zip.files)) {
        if (entry.dir || !entryPath.toLowerCase().endsWith(".txt")) continue;
        const fileName = path.basename(entryPath).toLowerCase();
        if (!fileName.includes("signal")) continue;

        const fileContent = await entry.async("string");
        signalCoords.push(...extractSignalCoordinates(fileContent));
      }

      if (signalCoords.length === 0) {
        item.bounds = null;
        continue;
      }

      const minLat = Math.min(...signalCoords.map((point) => point.lat));
      const minLon = Math.min(...signalCoords.map((point) => point.lon));
      const maxLat = Math.max(...signalCoords.map((point) => point.lat));
      const maxLon = Math.max(...signalCoords.map((point) => point.lon));

      item.bounds = {
        min: { lat: minLat, lon: minLon },
        max: { lat: maxLat, lon: maxLon },
      };
    } catch (error) {
      console.warn(`Skipping ${gtssUrl}: ${error instanceof Error ? error.message : String(error)}`);
      item.bounds = item.bounds ?? null;
    }
  }

  await fs.writeFile(libraryFilePath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
  console.log(`Updated bounds in ${path.relative(rootDir, libraryFilePath)}`);
}

async function main() {
  for (const libraryFilePath of libraryFiles) {
    try {
      await updateBoundsForLibraryFile(libraryFilePath);
    } catch (error) {
      console.error(`Failed to update ${libraryFilePath}:`, error instanceof Error ? error.message : error);
    }
  }
}

await main();
