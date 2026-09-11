import { describe, expect, it } from "vitest";
import type { Approach, Signal } from "../schema/schema";
import {
  cn,
  getDerivedStreetNames,
  getSignalDisplayName,
  suggestStreetNameForApproach,
} from "../src/utils";

const signal = (signalId: string, latitude = 47.61, longitude = -122.33): Signal => ({
  id: signalId,
  signalId,
  agencyId: "CITY",
  streetName1: "Fallback One",
  streetName2: "Fallback Two",
  latitude,
  longitude,
});

const approach = (
  signalId: string,
  streetName: string,
  compassBearing: number | null,
): Approach => ({
  id: `${signalId}-${streetName}`,
  approachId: `${signalId}-${streetName}`,
  signalId,
  streetName,
  compassBearing,
  postedSpeed: null,
  freeRight: 0,
  freeRightLanes: 1,
});

describe("GTSS utilities", () => {
  it("merges class names and derives unique street names", () => {
    const approaches = [
      approach("SIG-1", "Main Street", 0),
      approach("SIG-1", "Main Street", 180),
      approach("SIG-1", "First Avenue", 90),
    ];

    expect(cn("px-2", false, "px-4", "text-sm")).toBe("px-4 text-sm");
    expect(getDerivedStreetNames("SIG-1", approaches)).toEqual({
      streetName1: "Main Street",
      streetName2: "First Avenue",
    });
    expect(getSignalDisplayName(signal("SIG-1"), approaches)).toBe(
      "SIG-1 - Main Street & First Avenue",
    );
    expect(getSignalDisplayName(signal("SIG-2"), approaches)).toBe(
      "SIG-2 - Fallback One & Fallback Two",
    );
  });

  it("suggests a nearby same-direction street and ignores unsuitable approaches", () => {
    const signals = [
      signal("CURRENT"),
      signal("NEARBY", 47.611, -122.33),
      signal("FAR", 48, -122.33),
    ];
    const approaches = [
      approach("CURRENT", "Current Street", 0),
      approach("NEARBY", "Main Street", 180),
      approach("FAR", "Distant Street", 0),
      approach("NEARBY", "Cross Street", 90),
    ];

    expect(
      suggestStreetNameForApproach({
        bearing: 0,
        signalLat: 47.61,
        signalLng: -122.33,
        currentSignalId: "CURRENT",
        signals,
        approaches,
      }),
    ).toBe("Main Street");
    expect(
      suggestStreetNameForApproach({
        bearing: Number.NaN,
        signalLat: 47.61,
        signalLng: -122.33,
        currentSignalId: "CURRENT",
        signals,
        approaches,
      }),
    ).toBeNull();
  });
});
