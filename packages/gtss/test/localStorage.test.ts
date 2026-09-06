import { beforeEach, describe, expect, it } from 'vitest';
import {
  agencyStorage,
  approachStorage,
  basicTimingStorage,
  clearAllData,
  detectorStorage,
  exportData,
  generateApproachesCSV,
  generateBasicTimingsCSV,
  generateDetectionCSV,
  generatePhasesCSV,
  generateSignalsCSV,
  importData,
  parseApproachesTXT,
  parseBasicTimingsTXT,
  parseDetectorsTXT,
  parsePhasesTXT,
  parseSignalsTXT,
  phaseStorage,
  signalStorage,
} from '../src/localStorage';
import { useGTSSStore } from '../store/gtss-store';

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
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  useGTSSStore.getState().loadFromStorage();
});

describe('GTSS local storage lifecycle', () => {
  it('saves data and loads it into the store', () => {
    const agency = agencyStorage.save({
      agencyId: 'CITY',
      agencyName: 'City Traffic',
      agencyTimezone: 'America/Los_Angeles',
    });
    const signal = signalStorage.save({
      agencyId: agency.agencyId,
      signalId: 'SIG-1',
      streetName1: 'First Street',
      streetName2: 'Main Avenue',
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

  it('modifies a signal and keeps dependent records linked to its new ID', () => {
    signalStorage.save({
      agencyId: 'CITY',
      signalId: 'SIG-1',
      streetName1: 'First Street',
      streetName2: 'Main Avenue',
      latitude: 47.61,
      longitude: -122.33,
    });
    const approach = approachStorage.save({ signalId: 'SIG-1', streetName: 'First Street' });
    const phase = phaseStorage.save({ signalId: 'SIG-1', phase: 2, movementType: 'Through' });
    const detector = detectorStorage.save({
      signalId: 'SIG-1',
      channel: '1',
      phase: 2,
      purpose: 'Stop Bar',
      technologyType: 'Video',
    });
    const timing = basicTimingStorage.save({ signalId: 'SIG-1', phase: 2 });

    const updatedSignal = signalStorage.update('SIG-1', {
      signalId: 'SIG-NEW',
      streetName1: 'Updated Street',
    });

    expect(updatedSignal).toMatchObject({ signalId: 'SIG-NEW', streetName1: 'Updated Street' });
    expect(signalStorage.get('SIG-1')).toBeUndefined();
    expect(signalStorage.get('SIG-NEW')).toMatchObject({ signalId: 'SIG-NEW' });
    expect(approachStorage.getAll()).toContainEqual(expect.objectContaining({ id: approach.id, signalId: 'SIG-NEW' }));
    expect(phaseStorage.getAll()).toContainEqual(expect.objectContaining({ id: phase.id, signalId: 'SIG-NEW' }));
    expect(detectorStorage.getAll()).toContainEqual(expect.objectContaining({ id: detector.id, signalId: 'SIG-NEW' }));
    expect(basicTimingStorage.getAll()).toContainEqual(expect.objectContaining({ id: timing.id, signalId: 'SIG-NEW' }));
  });

  it('normalizes, updates, and deletes related records', () => {
    localStorage.setItem('gtss_approaches', JSON.stringify([{
      id: 'legacy-approach',
      approachId: 'SIG-1-0',
      signalId: 'SIG-1',
      streetName: 'Legacy Street',
      compassBearing: null,
      postedSpeed: null,
      freeRight: true,
      freeRightLanes: 0,
    }]));
    localStorage.setItem('gtss_phases', JSON.stringify([{
      id: 'legacy-phase',
      signalId: 'SIG-1',
      phase: 1,
      movementType: 'Left Turn',
      isPedestrian: true,
      numOfLanes: 1,
      approachId: null,
      crosswalkLength: null,
    }]));

    expect(approachStorage.getAll()[0]).toMatchObject({ freeRight: 1, freeRightLanes: 1 });
    expect(phaseStorage.getAll()[0]).toMatchObject({ isPedestrian: 1 });

    const approach = approachStorage.save({
      signalId: 'SIG-1',
      streetName: 'First Street',
      freeRight: 1,
      freeRightLanes: 1,
    });
    const phase = phaseStorage.save({ signalId: 'SIG-1', phase: 2, movementType: 'Left Turn', isPedestrian: 1 });
    const detector = detectorStorage.save({
      signalId: 'SIG-1',
      channel: '1',
      phase: 2,
      purpose: 'Stop Bar',
      technologyType: 'Video',
    });
    const timing = basicTimingStorage.save({ signalId: 'SIG-1', phase: 2, minGreen: 10 });

    expect(approach).toMatchObject({ approachId: 'SIG-1-2', freeRight: 1, freeRightLanes: 1 });
    expect(phase).toMatchObject({ isPedestrian: 1, numOfLanes: 1 });
    expect(approachStorage.update(approach.id, { freeRight: 3, freeRightLanes: 2 })).toMatchObject({ freeRight: 3, freeRightLanes: 2 });
    expect(phaseStorage.update(phase.id, { isPedestrian: 0 })).toMatchObject({ isPedestrian: 0 });
    expect(detectorStorage.update(detector.id, { lane: 'Left' })).toMatchObject({ lane: 'Left' });
    expect(basicTimingStorage.update(timing.id, { maxGreen: 35 })).toMatchObject({ maxGreen: 35 });

    approachStorage.delete(approach.id);
    phaseStorage.delete(phase.id);
    detectorStorage.delete(detector.id);
    basicTimingStorage.delete(timing.id);
    approachStorage.delete('legacy-approach');
    phaseStorage.delete('legacy-phase');

    expect(approachStorage.getAll()).toEqual([]);
    expect(phaseStorage.getAll()).toEqual([]);
    expect(detectorStorage.getAll()).toEqual([]);
    expect(basicTimingStorage.getAll()).toEqual([]);
  });

  it('merges imports without duplicating natural keys and clears signal data', () => {
    const original = signalStorage.save({
      agencyId: 'CITY',
      signalId: 'SIG-1',
      streetName1: 'First Street',
      streetName2: 'Main Avenue',
      latitude: 47.61,
      longitude: -122.33,
    });
    const additional = { ...original, id: 'signal-2', signalId: 'SIG-2' };

    importData({ signals: [original, additional] }, 'merge');

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

  it('parses and generates GTSS TXT records', () => {
    const signals = parseSignalsTXT('signal_id,agency_id,latitude,longitude\nSIG-1,CITY,47.61,-122.33');
    const approaches = parseApproachesTXT('approach_id,signal_id,street_name,compass_bearing,posted_speed,free_right\nSIG-1-1,SIG-1,"First, Street",90,25,2-FR-P');
    const phases = parsePhasesTXT('phase,signal_id,movement_type,num_of_lanes,approach_id,PedX,crosswalk_length\n2,SIG-1,T,2,SIG-1-1,1,48');
    const detectors = parseDetectorsTXT('channel,signal_id,phase,description,purpose,vehicle_type,lane,technology_type,length,stopbar_setback_dist\n1,SIG-1,2,Camera,Stop Bar,Car,Left,Video,20,5');
    const timings = parseBasicTimingsTXT('phase,signal_id,ped_walk,ped_clearance,leading_ped_interval,min_green,max_green,yellow,all_red,veh_recall_type,ped_recall\n2,SIG-1,7,14,2,10,35,3,1,Max,true');

    expect(approaches[0]).toMatchObject({ streetName: 'First, Street', freeRight: 2, freeRightLanes: 2 });
    expect(phases[0]).toMatchObject({ movementType: 'Through', isPedestrian: 1, crosswalkLength: 48 });
    expect(detectors[0]).toMatchObject({ length: 20, stopbarSetbackDist: 5 });
    expect(timings[0]).toMatchObject({ vehRecallType: 'Max', pedRecall: true });
    expect(generateSignalsCSV(signals)).toContain('SIG-1,CITY,47.61,-122.33');
    expect(generateApproachesCSV(approaches)).toContain('2-FR-P');
    expect(generatePhasesCSV(phases, timings, approaches)).toContain('2,SIG-1,T,2,SIG-1-1,1,48');
    expect(generateDetectionCSV(detectors)).toContain('1,SIG-1,2,Camera,Stop Bar,Car,Left,Video,20,5');
    expect(generateBasicTimingsCSV(timings)).toContain('2,SIG-1,7,14,2,10,35,3,1,Max,true');
  });
});