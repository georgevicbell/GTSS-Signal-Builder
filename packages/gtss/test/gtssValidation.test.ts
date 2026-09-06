import { describe, expect, it } from 'vitest';
import type { Detector, Phase, Signal } from '../shared/schema';
import { evaluateGTSSCompleteness } from '../src/gtssValidation';

const signal = (signalId: string): Signal => ({
  id: signalId,
  signalId,
  agencyId: 'CITY',
  streetName1: `${signalId} First`,
  streetName2: `${signalId} Second`,
  latitude: 47.61,
  longitude: -122.33,
});

const phase = (signalId: string, number: number): Phase => ({
  id: `${signalId}-phase-${number}`,
  signalId,
  phase: number,
  movementType: 'Through',
  isPedestrian: 1,
  numOfLanes: 1,
  approachId: null,
  crosswalkLength: null,
});

const detector = (signalId: string, channel: number): Detector => ({
  id: `${signalId}-detector-${channel}`,
  signalId,
  channel: String(channel),
  phase: 2,
  description: null,
  purpose: 'Stop Bar',
  vehicleType: null,
  lane: null,
  technologyType: 'Video',
  length: null,
  stopbarSetbackDist: null,
});

describe('evaluateGTSSCompleteness', () => {
  it('categorizes complete, partial, and incomplete signals', () => {
    const signals = [signal('COMPLETE'), signal('PARTIAL'), signal('EMPTY')];
    const phases = [
      ...Array.from({ length: 8 }, (_, index) => phase('COMPLETE', index + 1)),
      ...Array.from({ length: 8 }, (_, index) => phase('PARTIAL', index + 1)),
    ];
    const detectors = [
      ...Array.from({ length: 4 }, (_, index) => detector('COMPLETE', index + 1)),
      detector('PARTIAL', 1),
    ];

    expect(evaluateGTSSCompleteness(signals, phases, detectors)).toMatchObject({
      totalSignals: 3,
      completeSignals: 1,
      partialSignals: 1,
      incompleteSignals: 1,
      overallCompleteness: 33,
      results: [
        { signalId: 'COMPLETE', street: 'COMPLETE First & COMPLETE Second', overallScore: '100%', status: 'complete' },
        { signalId: 'PARTIAL', phaseCompleteness: '100%', detectorCompleteness: '25%', overallScore: '63%', status: 'partial' },
        { signalId: 'EMPTY', overallScore: '0%', status: 'incomplete' },
      ],
    });
  });

  it('returns an empty summary when no signals exist', () => {
    expect(evaluateGTSSCompleteness([], [], [])).toMatchObject({
      totalSignals: 0,
      overallCompleteness: 0,
      results: [],
    });
  });
});