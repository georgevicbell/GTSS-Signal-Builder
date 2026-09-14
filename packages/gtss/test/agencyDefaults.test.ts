import { describe, expect, it } from "vitest";
import type { Approach } from "../schema/public";
import {
  bearingToCardinal,
  guessPhaseDirectionMapping,
  isMapScrollZoomEnabled,
  isTypicallyThroughPhase,
  sanitizePhaseDirectionStandard,
  validatePhaseDirectionStandard,
} from "../src/agencyDefaults";

const approach = (approachId: string, compassBearing: number | null): Approach => ({
  id: approachId,
  approachId,
  signalId: "SIG-1",
  streetName: approachId,
  compassBearing,
  postedSpeed: null,
  freeRight: 0,
  freeRightLanes: 1,
});

describe("agency defaults helpers", () => {
  it("handles map modes and bearing boundaries", () => {
    expect(isMapScrollZoomEnabled(null)).toBe(false);
    expect(isMapScrollZoomEnabled({ mapScrollWheel: "zoom" } as never)).toBe(true);
    expect(isMapScrollZoomEnabled({ mapScrollWheel: "page" } as never)).toBe(false);

    expect(bearingToCardinal(null)).toBeNull();
    expect(bearingToCardinal(undefined)).toBeNull();
    expect(bearingToCardinal(0)).toBe("N");
    expect(bearingToCardinal(45)).toBe("E");
    expect(bearingToCardinal(135)).toBe("S");
    expect(bearingToCardinal(225)).toBe("W");
    expect(bearingToCardinal(360)).toBe("N");
    expect(bearingToCardinal(-45)).toBe("N");
  });

  it("sanitizes and validates phase direction standards", () => {
    expect(
      sanitizePhaseDirectionStandard({ N: [1, 1, 2, 0, 9, 2], E: ["4" as never, NaN] }),
    ).toEqual({
      N: [1, 2],
      E: [4],
    });
    expect(validatePhaseDirectionStandard({ N: [2], E: [2, 9], S_left: ["bad" as never] })).toEqual(
      [
        "E: phase number 9 is out of range (must be 1–8)",
        "S_left: phase number bad is out of range (must be 1–8)",
        "Phase numbers assigned to multiple directions: 2",
      ],
    );
    expect(validatePhaseDirectionStandard({ N: [2], E: [4] })).toEqual([]);
  });

  it("maps approaches to through and opposing left phases", () => {
    const approaches = [
      approach("NORTH", 0),
      approach("EAST", 90),
      approach("SOUTH", 180),
      approach("WEST", 270),
      approach("UNKNOWN", null),
    ];

    expect(guessPhaseDirectionMapping({ phaseCount: 4, approaches, agencyDefaults: null })).toEqual(
      {
        2: "EAST",
        4: "NORTH",
        6: "WEST",
        8: "SOUTH",
      },
    );
    expect(
      guessPhaseDirectionMapping({
        phaseCount: 6,
        approaches,
        agencyDefaults: {
          agencyId: "CITY",
          phaseDirectionStandard: { N: [8], S: [2], N_left: [1], S_left: [5] },
          defaultPhaseCount: 6,
          mapScrollWheel: "page",
          updatedAt: "2026-01-01",
        },
      }),
    ).toMatchObject({ 8: "NORTH", 2: "SOUTH", 1: "NORTH", 5: "SOUTH" });
  });

  it("classifies even phases as through movements", () => {
    expect(isTypicallyThroughPhase(2)).toBe(true);
    expect(isTypicallyThroughPhase(3)).toBe(false);
  });
});
