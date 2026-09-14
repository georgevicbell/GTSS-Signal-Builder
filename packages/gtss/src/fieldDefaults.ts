export const POSTED_SPEED_LIMITS = {
  imperial: { min: 0, max: 100, defaultValue: 35 },
  metric: { min: 0, max: 200, defaultValue: 50 },
} as const;

export const MIN_DETECTOR_LENGTH = 0;
export const DEFAULT_DETECTOR_LENGTH = {
  imperial: 6,
  metric: 1.8,
} as const;

export const MIN_STOPBAR_SETBACK_DISTANCE = 0;
export const DEFAULT_STOPBAR_SETBACK_DISTANCE = 0;
