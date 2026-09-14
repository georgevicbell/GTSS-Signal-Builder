export const STORAGE_KEYS = {
  AGENCY: "gtss_agency",
  DEFAULT_AGENCY: "gtss_default_agency",
  SIGNALS: "gtss_signals",
  PHASES: "gtss_phases",
  DETECTORS: "gtss_detectors",
  APPROACHES: "gtss_approaches",
  BASIC_TIMINGS: "gtss_basic_timings",
  AGENCY_DEFAULTS: "gtss_agency_defaults",
} as const;

export const MAX_STORAGE_SIZE = 5 * 1024 * 1024;
export const PED_RENUMBER_FLAG = "gtss_ped_renumber_v2_done";
