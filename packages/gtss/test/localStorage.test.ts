import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData } from "../src/localStorage/clearAll";
import {
  crosswalkLengthCode,
  generateAgenciesCSV,
  generateAgencyCSV,
  generateApproachesCSV,
  generateBasicTimingsCSV,
  generateDetectionCSV,
  generatePhasesCSV,
  generateSignalsCSV,
} from "../src/localStorage/csv-export";
import { exportAsIndividualFiles, exportData } from "../src/localStorage/exports";
import { importData } from "../src/localStorage/imports";
import { isMetricForSignalId } from "../src/localStorage/agency-units";
import {
  parseApproachesTXT,
  parseBasicTimingsTXT,
  parseDetectorsTXT,
  parsePhasesTXT,
  parseSignalsTXT,
} from "../src/localStorage/parsers";
import {
  agencyListStorage,
  agencyStorage,
  agencyDefaultsStorage,
  approachStorage,
  basicTimingStorage,
  detectorStorage,
  phaseStorage,
  signalStorage,
} from "../src/localStorage/storage";
import { parseAgenciesTXT, parseAgencyTXT } from "../src/localStorage/storage/agencies";
import { useGTSSStore } from "../store/gtss-store";
import * as localStorageApi from "../src/localStorage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  useGTSSStore.getState().loadFromStorage();
});

describe("GTSS local storage lifecycle", () => {
  it("keeps the localStorage compatibility barrel public", () => {
    expect(localStorageApi.clearAllData).toBeTypeOf("function");
    expect(localStorageApi.importData).toBeTypeOf("function");
    expect(localStorageApi.exportData).toBeTypeOf("function");
    expect(localStorageApi.generateSignalsCSV).toBeTypeOf("function");
    expect(localStorageApi.parseSignalsTXT).toBeTypeOf("function");
  });

  it("saves data and loads it into the store", () => {
    const agency = agencyStorage.save({
      agencyId: "CITY",
      agencyName: "City Traffic",
      agencyTimezone: "America/Los_Angeles",
    });
    const signal = signalStorage.save({
      agencyId: agency.agencyId,
      signalId: "SIG-1",
      streetName1: "First Street",
      streetName2: "Main Avenue",
      latitude: 47.61,
      longitude: -122.33,
    });

    useGTSSStore.getState().loadFromStorage();

    expect(agencyStorage.get()).toEqual(agency);
    expect(useGTSSStore.getState()).toMatchObject({
      agency,
      signals: [signal],
    });
  });

  it("modifies a signal and keeps dependent records linked to its new ID", () => {
    signalStorage.save({
      agencyId: "CITY",
      signalId: "SIG-1",
      streetName1: "First Street",
      streetName2: "Main Avenue",
      latitude: 47.61,
      longitude: -122.33,
    });
    const approach = approachStorage.save({ signalId: "SIG-1", streetName: "First Street" });
    const phase = phaseStorage.save({ signalId: "SIG-1", phase: 2, movementType: "Through" });
    const detector = detectorStorage.save({
      signalId: "SIG-1",
      channel: "1",
      phase: 2,
      purpose: "Stop Bar",
      technologyType: "Video",
    });
    const timing = basicTimingStorage.save({ signalId: "SIG-1", phase: 2 });

    const updatedSignal = signalStorage.update("SIG-1", {
      signalId: "SIG-NEW",
      streetName1: "Updated Street",
    });

    expect(updatedSignal).toMatchObject({ signalId: "SIG-NEW", streetName1: "Updated Street" });
    expect(signalStorage.get("SIG-1")).toBeUndefined();
    expect(signalStorage.get("SIG-NEW")).toMatchObject({ signalId: "SIG-NEW" });
    expect(approachStorage.getAll()).toContainEqual(
      expect.objectContaining({ id: approach.id, signalId: "SIG-NEW" }),
    );
    expect(phaseStorage.getAll()).toContainEqual(
      expect.objectContaining({ id: phase.id, signalId: "SIG-NEW" }),
    );
    expect(detectorStorage.getAll()).toContainEqual(
      expect.objectContaining({ id: detector.id, signalId: "SIG-NEW" }),
    );
    expect(basicTimingStorage.getAll()).toContainEqual(
      expect.objectContaining({ id: timing.id, signalId: "SIG-NEW" }),
    );
  });

  it("normalizes, updates, and deletes related records", () => {
    localStorage.setItem(
      "gtss_approaches",
      JSON.stringify([
        {
          id: "legacy-approach",
          approachId: "SIG-1-0",
          signalId: "SIG-1",
          streetName: "Legacy Street",
          compassBearing: null,
          postedSpeed: null,
          freeRight: true,
          freeRightLanes: 0,
        },
      ]),
    );
    localStorage.setItem(
      "gtss_phases",
      JSON.stringify([
        {
          id: "legacy-phase",
          signalId: "SIG-1",
          phase: 1,
          movementType: "Left Turn",
          isPedestrian: true,
          numOfLanes: 1,
          approachId: null,
          crosswalkLength: null,
        },
      ]),
    );

    expect(approachStorage.getAll()[0]).toMatchObject({ freeRight: 1, freeRightLanes: 1 });
    expect(phaseStorage.getAll()[0]).toMatchObject({ isPedestrian: 1 });

    const approach = approachStorage.save({
      signalId: "SIG-1",
      streetName: "First Street",
      freeRight: 1,
      freeRightLanes: 1,
    });
    const phase = phaseStorage.save({
      signalId: "SIG-1",
      phase: 2,
      movementType: "Left Turn",
      isPedestrian: 1,
    });
    const detector = detectorStorage.save({
      signalId: "SIG-1",
      channel: "1",
      phase: 2,
      purpose: "Stop Bar",
      technologyType: "Video",
    });
    const timing = basicTimingStorage.save({ signalId: "SIG-1", phase: 2, minGreen: 10 });

    expect(approach).toMatchObject({ approachId: "SIG-1-2", freeRight: 1, freeRightLanes: 1 });
    expect(phase).toMatchObject({ isPedestrian: 1, numOfLanes: 1 });
    expect(approachStorage.update(approach.id, { freeRight: 3, freeRightLanes: 2 })).toMatchObject({
      freeRight: 3,
      freeRightLanes: 2,
    });
    expect(phaseStorage.update(phase.id, { isPedestrian: 0 })).toMatchObject({ isPedestrian: 0 });
    expect(detectorStorage.update(detector.id, { lane: "Left" })).toMatchObject({ lane: "Left" });
    expect(basicTimingStorage.update(timing.id, { maxGreen: 35 })).toMatchObject({ maxGreen: 35 });

    approachStorage.delete(approach.id);
    phaseStorage.delete(phase.id);
    detectorStorage.delete(detector.id);
    basicTimingStorage.delete(timing.id);
    approachStorage.delete("legacy-approach");
    phaseStorage.delete("legacy-phase");

    expect(approachStorage.getAll()).toEqual([]);
    expect(phaseStorage.getAll()).toEqual([]);
    expect(detectorStorage.getAll()).toEqual([]);
    expect(basicTimingStorage.getAll()).toEqual([]);
  });

  it("merges imports without duplicating natural keys and clears signal data", () => {
    const original = signalStorage.save({
      agencyId: "CITY",
      signalId: "SIG-1",
      streetName1: "First Street",
      streetName2: "Main Avenue",
      latitude: 47.61,
      longitude: -122.33,
    });
    const additional = { ...original, id: "signal-2", signalId: "SIG-2" };

    importData({ signals: [original, additional] }, "merge");

    expect(exportData().signals).toEqual([original, additional]);
    clearAllData();
    expect(exportData()).toMatchObject({
      agency: null,
      signals: [],
      approaches: [],
      phases: [],
      detectors: [],
      basicTimings: [],
    });
  });

  it("parses and generates GTSS TXT records", () => {
    const signals = parseSignalsTXT(
      "signal_id,agency_id,latitude,longitude\nSIG-1,CITY,47.61,-122.33",
    );
    const approaches = parseApproachesTXT(
      'approach_id,signal_id,street_name,compass_bearing,posted_speed,free_right\nSIG-1-1,SIG-1,"First, Street",90,25,2-FR-P',
    );
    const phases = parsePhasesTXT(
      "phase,signal_id,movement_type,num_of_lanes,approach_id,PedX,crosswalk_length\n2,SIG-1,T,2,SIG-1-1,1,48",
    );
    const detectors = parseDetectorsTXT(
      "channel,signal_id,phase,description,purpose,vehicle_type,lane,technology_type,length,stopbar_setback_dist\n1,SIG-1,2,Camera,Stop Bar,Car,Left,Video,20,5",
    );
    const timings = parseBasicTimingsTXT(
      "phase,signal_id,ped_walk,ped_clearance,leading_ped_interval,min_green,max_green,yellow,all_red,veh_recall_type,ped_recall\n2,SIG-1,7,14,2,10,35,3,1,Max,true",
    );

    expect(approaches[0]).toMatchObject({
      streetName: "First, Street",
      freeRight: 2,
      freeRightLanes: 2,
    });
    expect(phases[0]).toMatchObject({
      movementType: "Through",
      isPedestrian: 1,
      crosswalkLength: 48,
    });
    expect(detectors[0]).toMatchObject({ length: 20, stopbarSetbackDist: 5 });
    expect(timings[0]).toMatchObject({ vehRecallType: "Max", pedRecall: true });
    expect(generateSignalsCSV(signals)).toContain("SIG-1,CITY,47.61,-122.33");
    expect(generateApproachesCSV(approaches)).toContain("2-FR-P");
    expect(generatePhasesCSV(phases, timings, approaches)).toContain("2,SIG-1,T,2,SIG-1-1,1,48");
    expect(generateDetectionCSV(detectors)).toContain(
      "1,SIG-1,2,Camera,Stop Bar,Car,Left,Video,20,5",
    );
    expect(generateBasicTimingsCSV(timings)).toContain("2,SIG-1,7,14,2,10,35,3,1,Max,true");
  });

  it("resolves metric units from the signal agency and default agency", () => {
    const defaultAgency = agencyStorage.save({
      agencyId: "US",
      agencyName: "US Agency",
      agencyTimezone: "America/Los_Angeles",
      agencyIsMetric: false,
    });
    agencyStorage.save({
      agencyId: "CA",
      agencyName: "Metric Agency",
      agencyTimezone: "America/Vancouver",
      agencyIsMetric: true,
    });
    signalStorage.save({
      agencyId: "CA",
      signalId: "METRIC-1",
      streetName1: "First Street",
      streetName2: "Main Avenue",
      latitude: 49,
      longitude: -123,
    });

    expect(isMetricForSignalId("METRIC-1")).toBe(true);
    expect(isMetricForSignalId("UNKNOWN")).toBe(defaultAgency.agencyIsMetric);
    expect(isMetricForSignalId()).toBe(false);
  });

  it("replaces imported data and stores metric detector distances in centimeters", () => {
    importData(
      {
        agency: {
          id: "agency-metric",
          agencyId: "CA",
          agencyName: "Metric Agency",
          agencyTimezone: "America/Vancouver",
          agencyIsMetric: true,
        },
        signals: [
          {
            id: "signal-metric",
            signalId: "METRIC-1",
            agencyId: "CA",
            streetName1: "First Street",
            streetName2: "Main Avenue",
            latitude: 49,
            longitude: -123,
          },
        ],
        detectors: [
          {
            id: "detector-metric",
            signalId: "METRIC-1",
            channel: "1",
            phase: null,
            description: null,
            purpose: "Stop Bar",
            vehicleType: null,
            lane: null,
            technologyType: "Video",
            length: 2.5,
            stopbarSetbackDist: 4,
            approachId: null,
          },
        ],
      },
      "replace",
    );

    expect(agencyStorage.get()).toMatchObject({ agencyId: "CA", agencyIsMetric: true });
    expect(detectorStorage.getAll()[0]).toMatchObject({ length: 2.5, stopbarSetbackDist: 4 });
    expect(localStorage.getItem("gtss_detectors")).toContain('"length":250');
    expect(localStorage.getItem("gtss_detectors")).toContain('"stopbarSetbackDist":400');
  });

  it("reports validation errors for malformed imported records", () => {
    expect(() =>
      parseSignalsTXT("signal_id,agency_id,latitude,longitude\nSIG-1,CITY,nope,-122"),
    ).toThrow(/Latitude must be a valid number/);
    expect(() =>
      parseApproachesTXT(
        "approach_id,signal_id,street_name,compass_bearing,posted_speed\nA-1,SIG-1,Main,sideways,25",
      ),
    ).toThrow(/Compass bearing must be a valid integer/);
    expect(() =>
      parsePhasesTXT("phase,signal_id,movement_type,num_of_lanes,approach_id\n2,SIG-1,Unknown,1,"),
    ).toThrow(/Movement type .* is not recognized/);
    expect(() =>
      parseDetectorsTXT(
        "channel,signal_id,phase,description,purpose,vehicle_type,lane,technology_type,length,stopbar_setback_dist\n1,SIG-1,,Camera,Stop Bar,Car,Left,Video,nope,5",
      ),
    ).toThrow(/Length must be a valid number/);
    expect(() =>
      parseBasicTimingsTXT(
        "phase,signal_id,ped_walk,ped_clearance,leading_ped_interval,min_green,max_green,yellow,all_red,veh_recall_type,ped_recall\n2,SIG-1,,,,,,,,Bad,true",
      ),
    ).toThrow(/veh_recall_type must be None, Min, Max, or Soft/);
  });

  it("exports only the selected agency's files", async () => {
    const agency = agencyStorage.save({
      agencyId: "CITY",
      agencyName: "City Traffic",
      agencyTimezone: "America/Los_Angeles",
    });
    signalStorage.save({
      agencyId: agency.agencyId,
      signalId: "SIG-1",
      streetName1: "First Street",
      streetName2: "Main Avenue",
      latitude: 47.61,
      longitude: -122.33,
    });
    const downloads: string[] = [];
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        body: { appendChild: () => undefined, removeChild: () => undefined },
        createElement: () => ({
          click: () => downloads.push("downloaded"),
          download: "",
          href: "",
        }),
      },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    await exportAsIndividualFiles(
      {
        agency: false,
        signals: true,
        approaches: false,
        phases: false,
        detection: false,
        basicTimings: false,
      },
      [agency.id],
    );

    expect(downloads).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("handles agency parsing, default selection, and cascade deletion", () => {
    const agencies = parseAgenciesTXT(
      "agency_id,agency_name,agency_url,agency_timezone,agency_email,agency_ismetric\nCITY,City Traffic,,America/Los_Angeles,ops@city.test,true\nCOUNTY,County Traffic,https://county.test,America/Denver,,false",
    );
    expect(agencies).toHaveLength(2);
    expect(
      parseAgencyTXT(
        "agency_id,agency_name,agency_url,agency_timezone,agency_email\nCITY,City Traffic,,UTC,ops@city.test",
      ),
    ).toMatchObject({ agencyId: "CITY", agencyIsMetric: false });
    expect(() =>
      parseAgenciesTXT("agency_id,agency_name,agency_url,agency_timezone,agency_email"),
    ).toThrow(/at least one data row/);

    const first = agencyListStorage.save(agencies[0]);
    const second = agencyListStorage.save(agencies[1]);
    agencyListStorage.setDefaultId(second.id);
    expect(agencyStorage.get()).toMatchObject({ agencyId: "COUNTY" });

    signalStorage.save({
      agencyId: first.agencyId,
      signalId: "CITY-1",
      streetName1: "First Street",
      streetName2: "Main Avenue",
      latitude: 47,
      longitude: -122,
    });
    agencyListStorage.deleteWithCascade(first.id);
    expect(signalStorage.get("CITY-1")).toBeUndefined();
    expect(agencyListStorage.get(first.id)).toBeUndefined();
    expect(agencyListStorage.getDefaultId()).toBe(second.id);
  });

  it("covers empty and agency CSV output plus crosswalk estimates", () => {
    expect(generateAgencyCSV(null)).toContain("agency_id,agency_name");
    expect(generateAgenciesCSV([])).toBe(
      "agency_id,agency_name,agency_url,agency_timezone,agency_email,agency_ismetric\n",
    );
    expect(
      generateAgencyCSV({
        id: "agency-1",
        agencyId: "CITY",
        agencyName: "City, Traffic",
        agencyUrl: null,
        agencyTimezone: "UTC",
        agencyLanguage: null,
        agencyEmail: "ops@city.test",
        agencyIsMetric: true,
        latitude: null,
        longitude: null,
      }),
    ).toContain('"City, Traffic"');

    const pedestrianPhase = {
      id: "phase-1",
      signalId: "SIG-1",
      phase: 2,
      movementType: "Pedestrian" as const,
      isPedestrian: 1,
      numOfLanes: 1,
      approachId: null,
      crosswalkLength: null,
    };
    expect(
      crosswalkLengthCode({ ...pedestrianPhase, crosswalkLength: 42 }, [pedestrianPhase]),
    ).toBe("42");
    expect(crosswalkLengthCode({ ...pedestrianPhase, isPedestrian: 0 }, [pedestrianPhase])).toBe(
      "",
    );
    expect(
      crosswalkLengthCode(
        pedestrianPhase,
        [pedestrianPhase],
        [
          {
            id: "timing-1",
            signalId: "SIG-1",
            phase: 2,
            pedWalk: null,
            pedClearance: 10,
            leadingPedInterval: null,
            minGreen: null,
            maxGreen: null,
            yellow: null,
            allRed: null,
            vehRecallType: "None",
            pedRecall: false,
          },
        ],
      ),
    ).toBe("TE-35");
  });

  it("persists and normalizes agency defaults", () => {
    expect(agencyDefaultsStorage.get()).toBeNull();
    const saved = agencyDefaultsStorage.save({
      agencyId: "CITY",
      phaseDirectionStandard: {},
      defaultPhaseCount: 8,
      mapScrollWheel: "zoom",
      updatedAt: "old",
    });
    expect(saved.updatedAt).not.toBe("old");
    expect(agencyDefaultsStorage.get()).toMatchObject({ mapScrollWheel: "zoom" });
    localStorage.setItem(
      "gtss_agency_defaults",
      JSON.stringify({ ...saved, mapScrollWheel: "unknown" }),
    );
    expect(agencyDefaultsStorage.get()?.mapScrollWheel).toBe("page");
    agencyDefaultsStorage.clear();
    expect(agencyDefaultsStorage.get()).toBeNull();
  });

  it("imports all record types in replace and merge modes", () => {
    const importedAgency = {
      id: "agency-imported",
      agencyId: "IMPORTED",
      agencyName: "Imported Agency",
      agencyUrl: null,
      agencyTimezone: "UTC",
      agencyLanguage: null,
      agencyEmail: null,
      agencyIsMetric: false,
      latitude: null,
      longitude: null,
    };
    const importedSignal = {
      id: "signal-imported",
      signalId: "IMPORTED-1",
      agencyId: "IMPORTED",
      streetName1: "First",
      streetName2: "Second",
      latitude: 1,
      longitude: 2,
    };
    const importedApproach = {
      id: "approach-imported",
      approachId: "IMPORTED-1-1",
      signalId: "IMPORTED-1",
      streetName: "First",
      compassBearing: 0,
      postedSpeed: 25,
      freeRight: 0,
      freeRightLanes: 1,
    };
    const importedPhase = {
      id: "phase-imported",
      signalId: "IMPORTED-1",
      phase: 2,
      movementType: "Through",
      isPedestrian: 1,
      numOfLanes: 1,
      approachId: "IMPORTED-1-1",
      crosswalkLength: null,
    };
    const importedDetector = {
      id: "detector-imported",
      signalId: "IMPORTED-1",
      phase: 2,
      channel: "1",
      description: null,
      purpose: "Stop Bar",
      vehicleType: null,
      lane: null,
      technologyType: "Video",
      length: null,
      stopbarSetbackDist: null,
      approachId: "IMPORTED-1-1",
    };
    const importedTiming = {
      id: "timing-imported",
      signalId: "IMPORTED-1",
      phase: 2,
      pedWalk: null,
      pedClearance: null,
      leadingPedInterval: null,
      minGreen: 10,
      maxGreen: 35,
      yellow: 3,
      allRed: 1,
      vehRecallType: "Max",
      pedRecall: false,
    };

    importData(
      {
        agency: [importedAgency],
        signals: [importedSignal],
        approaches: [importedApproach],
        phases: [importedPhase],
        detectors: [importedDetector],
        basicTimings: [importedTiming],
      },
      "replace",
    );
    importData(
      {
        agency: [{ ...importedAgency, agencyName: "Updated Agency" }],
        signals: [importedSignal, { ...importedSignal, id: "signal-2", signalId: "IMPORTED-2" }],
        approaches: [
          importedApproach,
          {
            ...importedApproach,
            id: "approach-2",
            approachId: "IMPORTED-2-1",
            signalId: "IMPORTED-2",
          },
        ],
        phases: [importedPhase, { ...importedPhase, id: "phase-2", signalId: "IMPORTED-2" }],
        detectors: [
          importedDetector,
          { ...importedDetector, id: "detector-2", channel: "2", signalId: "IMPORTED-2" },
        ],
        basicTimings: [
          importedTiming,
          { ...importedTiming, id: "timing-2", signalId: "IMPORTED-2" },
        ],
      },
      "merge",
    );

    expect(agencyListStorage.getAll()).toHaveLength(1);
    expect(agencyStorage.get()?.agencyName).toBe("Updated Agency");
    expect(signalStorage.getAll()).toHaveLength(2);
    expect(approachStorage.getAll()).toHaveLength(2);
    expect(phaseStorage.getAll()).toHaveLength(2);
    expect(detectorStorage.getAll()).toHaveLength(2);
    expect(basicTimingStorage.getAll()).toHaveLength(2);
  });
});
