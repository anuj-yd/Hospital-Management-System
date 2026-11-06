import { describe, it, expect } from '@jest/globals';
import { computeChanges } from '../../src/modules/audit/audit.service.js';

describe('Audit Diff Helper Unit Tests', () => {
  it('detects modified fields accurately', () => {
    const oldState = { firstName: 'John', phone: '+919999900000', bloodGroup: 'O+' };
    const newState = { firstName: 'John', phone: '+918888800000', bloodGroup: 'A+' };

    const diff = computeChanges(oldState, newState);

    expect(diff).toEqual({
      phone: { old: '+919999900000', new: '+918888800000' },
      bloodGroup: { old: 'O+', new: 'A+' },
    });
  });

  it('strictly excludes sensitive keys like passwordHash and clinicalNotes', () => {
    const oldState = {
      fullName: 'Dr. Test',
      passwordHash: '$2a$10$oldHashStringValue...',
      clinicalNotes: 'Patient has high blood pressure and chest pain',
    };
    const newState = {
      fullName: 'Dr. Test Updated',
      passwordHash: '$2a$10$newHashStringValue...',
      clinicalNotes: 'Patient stabilized after medication adjustment',
    };

    const diff = computeChanges(oldState, newState);

    expect(diff).toEqual({
      fullName: { old: 'Dr. Test', new: 'Dr. Test Updated' },
    });
    expect(diff?.passwordHash).toBeUndefined();
    expect(diff?.clinicalNotes).toBeUndefined();
  });

  it('returns null when there are zero differences', () => {
    const state = { title: 'Cardiology', active: true };
    expect(computeChanges(state, state)).toBeNull();
  });
});

