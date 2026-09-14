import { describe, expect, it } from "vitest";
import {
  DEFAULT_DETECTOR_LENGTH,
  DEFAULT_STOPBAR_SETBACK_DISTANCE,
  MIN_DETECTOR_LENGTH,
  MIN_STOPBAR_SETBACK_DISTANCE,
  POSTED_SPEED_LIMITS,
} from "../src/fieldDefaults";

describe("GTSS field defaults", () => {
  it("defines unit-aware posted-speed limits and detector distance defaults", () => {
    expect(POSTED_SPEED_LIMITS).toEqual({
      imperial: { min: 0, max: 100, defaultValue: 35 },
      metric: { min: 0, max: 200, defaultValue: 50 },
    });
    expect(DEFAULT_DETECTOR_LENGTH).toEqual({ imperial: 6, metric: 1.8 });
    expect(MIN_DETECTOR_LENGTH).toBe(0);
    expect(MIN_STOPBAR_SETBACK_DISTANCE).toBe(0);
    expect(DEFAULT_STOPBAR_SETBACK_DISTANCE).toBe(0);
  });
});
