import { describe, expect, it } from "vitest";
import { generateProceduralIntersection, getAllDemoIntersections } from "../src/demoIntersections";

describe("demoIntersections", () => {
  it("provides preset intersections covering 2, 3, 4, and 5 approach configurations", () => {
    const demos = getAllDemoIntersections();
    expect(demos.length).toBeGreaterThanOrEqual(7);

    const counts = demos.map((d) => d.approachCount);
    expect(counts).toContain(2);
    expect(counts).toContain(3);
    expect(counts).toContain(4);
    expect(counts).toContain(5);

    demos.forEach((d) => {
      expect(d.approaches.length).toBe(d.approachCount);
      expect(d.phases.length).toBeGreaterThan(0);
      expect(d.detectors.length).toBeGreaterThan(0);
      expect(d.basicTimings.length).toBeGreaterThan(0);
      expect(d.signal.signalId).toBeTruthy();
    });
  });

  it("generates valid procedural intersections with 2, 3, 4, and 5 legs", () => {
    [2, 3, 4, 5].forEach((count) => {
      const proc = generateProceduralIntersection({
        approachCount: count as 2 | 3 | 4 | 5,
        baseBearing: 15,
        hasLeftTurns: true,
        hasSlipLanes: true,
        speed: 45,
        seed: 42,
      });

      expect(proc.approachCount).toBe(count);
      expect(proc.approaches.length).toBe(count);
      expect(proc.phases.length).toBeGreaterThanOrEqual(count);
      expect(proc.detectors.length).toBeGreaterThanOrEqual(count);
      expect(proc.basicTimings.length).toBeGreaterThanOrEqual(count);

      // Verify bearings are valid 0-359 integers
      proc.approaches.forEach((app) => {
        expect(app.compassBearing).toBeGreaterThanOrEqual(0);
        expect(app.compassBearing).toBeLessThan(360);
      });
    });
  });
});
