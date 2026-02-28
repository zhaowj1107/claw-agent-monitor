import { describe, it, expect } from 'vitest';
import { cronToHuman, nextCronRun } from './cronUtils.js';

describe('cronToHuman', () => {
  describe('called with individual fields', () => {
    it('formats a specific daily time', () => {
      expect(cronToHuman('5', '9', '*', '*', '*')).toBe('09:05');
    });

    it('pads single-digit hour and minute', () => {
      expect(cronToHuman('0', '8', '*', '*', '*')).toBe('08:00');
    });

    it('formats every-N-minutes schedule', () => {
      expect(cronToHuman('*/15', '*', '*', '*', '*')).toBe('every 15m');
    });

    it('formats every-N-hours schedule', () => {
      expect(cronToHuman('0', '*/6', '*', '*', '*')).toBe('every 6h');
    });

    it('formats hourly at a specific minute', () => {
      expect(cronToHuman('30', '*', '*', '*', '*')).toBe('hourly :30');
    });

    it('includes day-of-week prefix for specific weekday', () => {
      expect(cronToHuman('0', '9', '*', '*', '1')).toBe('Mon 09:00');
    });

    it('handles comma-separated weekdays', () => {
      expect(cronToHuman('0', '9', '*', '*', '1,5')).toBe('Mon,Fri 09:00');
    });

    it('falls back to raw expression for unusual patterns', () => {
      const result = cronToHuman('5', '*', '15', '*', '*');
      expect(result).toContain('5');
    });
  });

  describe('called with a full cron expression string', () => {
    it('parses a full expression as the first argument', () => {
      expect(cronToHuman('0 9 * * 1')).toBe('Mon 09:00');
    });

    it('returns the expression unchanged if fewer than 5 fields', () => {
      expect(cronToHuman('0 9 * *')).toBe('0 9 * *');
    });

    it('accepts an optional timezone as second argument', () => {
      const result = cronToHuman('0 9 * * *', 'America/New_York');
      expect(result).toContain('09:00');
      expect(result).toContain('New'); // tz abbreviation
    });
  });
});

describe('nextCronRun', () => {
  it('returns a timestamp in the future for a wildcard schedule', () => {
    const result = nextCronRun('*', '*', '*', '*', '*');
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(Date.now());
  });

  it('next wildcard run is within two minutes', () => {
    const result = nextCronRun('*', '*', '*', '*', '*');
    expect(result!).toBeLessThan(Date.now() + 2 * 60 * 1000);
  });

  it('returns a result within 6 minutes for every-5-minute schedule', () => {
    const result = nextCronRun('*/5', '*', '*', '*', '*');
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(Date.now() + 6 * 60 * 1000);
  });

  it('returns a result within 2 hours for every-2-hour schedule', () => {
    const result = nextCronRun('0', '*/2', '*', '*', '*');
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(Date.now() + 2 * 60 * 60 * 1000 + 60 * 1000);
  });

  it('handles comma-separated values', () => {
    const result = nextCronRun('0,30', '*', '*', '*', '*');
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(Date.now() + 31 * 60 * 1000);
  });

  it('handles range expressions', () => {
    const result = nextCronRun('0', '9-17', '*', '*', '*');
    expect(result).not.toBeNull();
  });

  it('returns null for a schedule that never fires within a week', () => {
    // day 32 never exists, month 13 never exists
    const result = nextCronRun('0', '0', '32', '13', '*');
    expect(result).toBeNull();
  });

  it('respects step-based day-of-week expressions', () => {
    // every 2nd day of week starting from Sunday
    const result = nextCronRun('0', '0', '*', '*', '*/2');
    expect(result).not.toBeNull();
  });
});
