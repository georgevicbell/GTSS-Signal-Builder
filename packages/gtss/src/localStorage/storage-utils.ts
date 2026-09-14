import type { Agency } from "../../schema/public";
import { MAX_STORAGE_SIZE } from "./keys";

export function hasPrototypePollution(obj: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(obj, "__proto__") ||
    Object.prototype.hasOwnProperty.call(obj, "constructor") ||
    Object.prototype.hasOwnProperty.call(obj, "prototype")
  );
}

export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_STORAGE_SIZE) {
      throw new Error("Data too large for localStorage. Please reduce the number of records.");
    }
    localStorage.setItem(key, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("localStorage quota exceeded");
      throw new Error("Storage quota exceeded. Please delete some data before adding more.", {
        cause: error,
      });
    }
    console.error("Failed to save to localStorage:", error);
    throw error;
  }
}

export function normalizeAgency(
  agency: (Partial<{ agencyIsMetric?: unknown }> & Record<string, unknown>) | null | undefined,
): Agency | null {
  if (agency == null) return null;
  return { ...agency, agencyIsMetric: !!agency.agencyIsMetric } as Agency;
}

export function storedDistanceToDisplay(value: number | null | undefined, isMetric: boolean) {
  if (value == null) return null;
  if (!isMetric) return value;
  const meters = Number(value) / 100;
  return Math.round(meters * 100) / 100;
}

export function displayDistanceToStored(value: number | null | undefined, isMetric: boolean) {
  if (value == null) return null;
  if (!isMetric) return value;
  return Math.round(Number(value) * 100);
}
