import { describe, expect, it } from "vitest";
import type { Agency, Approach, BasicTiming, Detector, Phase, Signal } from "../schema/public";
import { useGTSSStore } from "../store/gtss-store";

const agency: Agency = {
  id: "agency-1",
  agencyId: "CITY",
  agencyName: "City Traffic",
  agencyUrl: null,
  agencyTimezone: "UTC",
  agencyLanguage: null,
  agencyEmail: null,
  agencyIsMetric: false,
  latitude: null,
  longitude: null,
};

const signal = (signalId: string): Signal => ({
  id: `signal-${signalId}`,
  signalId,
  agencyId: "CITY",
  streetName1: "First Street",
  streetName2: "Main Avenue",
  latitude: 47,
  longitude: -122,
});

const approach: Approach = {
  id: "approach-1",
  approachId: "SIG-1-1",
  signalId: "SIG-1",
  streetName: "First Street",
  compassBearing: 0,
  postedSpeed: 25,
  freeRight: 0,
  freeRightLanes: 1,
};

const phase: Phase = {
  id: "phase-1",
  signalId: "SIG-1",
  phase: 2,
  movementType: "Through",
  isPedestrian: 1,
  numOfLanes: 1,
  approachId: approach.approachId,
  crosswalkLength: null,
};

const detector: Detector = {
  id: "detector-1",
  signalId: "SIG-1",
  phase: 2,
  channel: "1",
  description: null,
  purpose: "Stop Bar",
  vehicleType: null,
  lane: null,
  technologyType: "Video",
  length: null,
  stopbarSetbackDist: null,
  approachId: approach.approachId,
};

const timing: BasicTiming = {
  id: "timing-1",
  signalId: "SIG-1",
  phase: 2,
  pedWalk: null,
  pedClearance: null,
  leadingPedInterval: null,
  minGreen: null,
  maxGreen: null,
  yellow: null,
  allRed: null,
  vehRecallType: "None",
  pedRecall: false,
};

describe("GTSS store actions", () => {
  it("updates entity collections and navigation state", () => {
    const store = useGTSSStore.getState();
    store.setAgency(agency);
    store.setAgencies([agency]);
    store.setDefaultAgencyId(agency.id);
    store.setAgencyDefaults(null);
    store.setSignals([signal("SIG-1")]);
    store.addSignal(signal("SIG-2"));
    store.setApproaches([approach]);
    store.addApproach({ ...approach, id: "approach-2", approachId: "SIG-2-1", signalId: "SIG-2" });
    store.setPhases([phase]);
    store.addPhase({ ...phase, id: "phase-2", signalId: "SIG-2" });
    store.setDetectors([detector]);
    store.addDetector({ ...detector, id: "detector-2", signalId: "SIG-2" });
    store.setBasicTimings([timing]);
    store.addBasicTiming({ ...timing, id: "timing-2", signalId: "SIG-2" });

    store.updateSignal("SIG-1", { ...signal("SIG-NEW"), signalId: "SIG-NEW" });
    expect(useGTSSStore.getState().approaches[0].signalId).toBe("SIG-NEW");
    expect(useGTSSStore.getState().phases[0].signalId).toBe("SIG-NEW");
    expect(useGTSSStore.getState().detectors[0].signalId).toBe("SIG-NEW");
    expect(useGTSSStore.getState().basicTimings[0].signalId).toBe("SIG-NEW");

    store.updateApproach("approach-2", { ...approach, id: "approach-2", streetName: "Updated" });
    store.updatePhase("phase-2", { ...phase, id: "phase-2", movementType: "Left Turn" });
    store.updateDetector("detector-2", { ...detector, id: "detector-2", lane: "Left" });
    store.updateBasicTiming("timing-2", { ...timing, id: "timing-2", maxGreen: 35 });
    store.setTempNewSignalLocation({ latitude: 1, longitude: 2 });
    store.setSelectedSignalIdForTables("SIG-NEW");
    store.navigateToSignalDetails("SIG-NEW");
    store.setDeepLinkTarget({ type: "phase", id: "phase-2" });

    expect(useGTSSStore.getState()).toMatchObject({
      currentView: "signal-details",
      currentSignalId: "SIG-NEW",
      selectedSignalIdForTables: "SIG-NEW",
      tempNewSignalLocation: { latitude: 1, longitude: 2 },
      deepLinkTarget: { type: "phase", id: "phase-2" },
    });

    store.deleteApproach("approach-2");
    store.deletePhase("phase-2");
    store.deleteDetector("detector-2");
    store.deleteBasicTiming("timing-2");
    store.deleteSignal("SIG-NEW");
    expect(useGTSSStore.getState().signals).toEqual([signal("SIG-2")]);
    store.navigateToMain();
    expect(useGTSSStore.getState().currentView).toBe("main");
  });
});
