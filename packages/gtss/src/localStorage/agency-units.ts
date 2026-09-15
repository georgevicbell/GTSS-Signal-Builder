import type { Agency, Signal } from "../../schema/public";
import { STORAGE_KEYS } from "./keys";
import { getFromStorage, normalizeAgency } from "./storage-utils";

export function isMetricForSignalId(signalId?: string | null): boolean {
  try {
    const agencies = getFromStorage<Agency[] | Agency | null>(STORAGE_KEYS.AGENCY, null);
    const agencyList = Array.isArray(agencies) ? agencies : agencies ? [agencies] : [];
    const defaultAgencyId = getFromStorage<string | null>(STORAGE_KEYS.DEFAULT_AGENCY, null);
    const defaultAgency = normalizeAgency(
      agencyList.find((agency) => agency.id === defaultAgencyId) ?? agencyList[0],
    );

    if (!signalId) return defaultAgency?.agencyIsMetric ?? false;

    const signals = getFromStorage<Signal[]>(STORAGE_KEYS.SIGNALS, []);
    const signal = signals.find((item) => item.signalId === signalId);
    if (!signal) return defaultAgency?.agencyIsMetric ?? false;

    const agency = normalizeAgency(agencyList.find((item) => item.agencyId === signal.agencyId));
    return agency?.agencyIsMetric ?? defaultAgency?.agencyIsMetric ?? false;
  } catch {
    return false;
  }
}

// LHT — left-hand traffic. Mirrors isMetricForSignalId's per-signal → per-agency lookup.
export function isLhtForSignalId(signalId?: string | null): boolean {
  try {
    const agencies = getFromStorage<Agency[] | Agency | null>(STORAGE_KEYS.AGENCY, null);
    const agencyList = Array.isArray(agencies) ? agencies : agencies ? [agencies] : [];
    const defaultAgencyId = getFromStorage<string | null>(STORAGE_KEYS.DEFAULT_AGENCY, null);
    const defaultAgency = normalizeAgency(
      agencyList.find((agency) => agency.id === defaultAgencyId) ?? agencyList[0],
    );

    if (!signalId) return defaultAgency?.agencyIsLht ?? false;

    const signals = getFromStorage<Signal[]>(STORAGE_KEYS.SIGNALS, []);
    const signal = signals.find((item) => item.signalId === signalId);
    if (!signal) return defaultAgency?.agencyIsLht ?? false;

    const agency = normalizeAgency(agencyList.find((item) => item.agencyId === signal.agencyId));
    return agency?.agencyIsLht ?? defaultAgency?.agencyIsLht ?? false;
  } catch {
    return false;
  }
}
