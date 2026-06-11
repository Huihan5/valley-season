import { describe, it, expect } from 'vitest';
import { getFatigueStatus, getFatigueEffect } from '../src/systems/FatigueSystem';

describe('FatigueSystem', () => {
  it('normal at 0-2', () => {
    expect(getFatigueStatus(0)).toBe('normal');
    expect(getFatigueStatus(2)).toBe('normal');
  });

  it('tired at 3-4', () => {
    expect(getFatigueStatus(3)).toBe('tired');
    expect(getFatigueStatus(4)).toBe('tired');
  });

  it('exhausted at 5', () => {
    expect(getFatigueStatus(5)).toBe('exhausted');
  });

  it('has no effect when normal', () => {
    expect(getFatigueEffect(2)).toBeNull();
  });

  it('shows efficiency penalty when tired', () => {
    expect(getFatigueEffect(3)).toContain('-1');
  });

  it('shows forced rest when exhausted', () => {
    expect(getFatigueEffect(5)).toContain('强制');
  });
});
