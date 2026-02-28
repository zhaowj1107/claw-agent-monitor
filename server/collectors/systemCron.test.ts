import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { collectSystemCron } from './systemCron.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('collectSystemCron', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('returns empty jobs with a warning when crontab -l throws', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('no crontab for user'); });
    const result = collectSystemCron();
    expect(result.jobs).toEqual([]);
    expect(result.warning).toBe('crontab -l failed');
  });

  it('returns empty jobs for empty crontab output', () => {
    vi.mocked(execSync).mockReturnValue('');
    const result = collectSystemCron();
    expect(result.jobs).toHaveLength(0);
    expect(result.warning).toBeUndefined();
  });

  it('ignores comment lines', () => {
    vi.mocked(execSync).mockReturnValue('# This is a comment\n# Another comment\n');
    expect(collectSystemCron().jobs).toHaveLength(0);
  });

  it('ignores environment variable assignments', () => {
    vi.mocked(execSync).mockReturnValue('MAILTO=""\nSHELL=/bin/bash\nPATH=/usr/bin:/bin\n');
    expect(collectSystemCron().jobs).toHaveLength(0);
  });

  it('ignores blank lines', () => {
    vi.mocked(execSync).mockReturnValue('\n\n   \n');
    expect(collectSystemCron().jobs).toHaveLength(0);
  });

  // --- Standard 5-field cron entries ---

  it('parses a standard cron entry and extracts the binary name', () => {
    vi.mocked(execSync).mockReturnValue('0 2 * * * /usr/bin/backup.sh\n');
    const result = collectSystemCron();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].name).toBe('backup.sh');
    expect(result.jobs[0].source).toBe('system');
    expect(result.jobs[0].nextRun).not.toBeNull();
  });

  it('truncates long command names to 22 chars', () => {
    vi.mocked(execSync).mockReturnValue('0 9 * * * /usr/bin/very-long-program-name-here extra-arg\n');
    const result = collectSystemCron();
    expect(result.jobs[0].name.length).toBeLessThanOrEqual(22);
  });

  it('strips redirection from command name', () => {
    vi.mocked(execSync).mockReturnValue('0 9 * * * /usr/local/bin/myscript > /dev/null 2>&1\n');
    const result = collectSystemCron();
    expect(result.jobs[0].name).toBe('myscript');
  });

  it('strips sudo prefix from command name', () => {
    vi.mocked(execSync).mockReturnValue('0 9 * * * sudo /usr/local/bin/myprogram\n');
    const result = collectSystemCron();
    expect(result.jobs[0].name).toBe('myprogram');
  });

  it('strips pipe from command name', () => {
    vi.mocked(execSync).mockReturnValue('0 9 * * * /usr/bin/generate | /usr/bin/process\n');
    const result = collectSystemCron();
    expect(result.jobs[0].name).toBe('generate');
  });

  // --- @ shorthand entries ---

  it('parses @reboot entry', () => {
    vi.mocked(execSync).mockReturnValue('@reboot /usr/local/bin/startup.sh\n');
    const result = collectSystemCron();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].schedule).toBe('on reboot');
    expect(result.jobs[0].nextRun).toBeNull();
    expect(result.jobs[0].source).toBe('system');
  });

  it('parses @daily entry', () => {
    vi.mocked(execSync).mockReturnValue('@daily /usr/bin/cleanup.sh\n');
    const result = collectSystemCron();
    expect(result.jobs[0].schedule).toBe('daily 00:00');
  });

  it('parses @hourly entry', () => {
    vi.mocked(execSync).mockReturnValue('@hourly /usr/bin/poll.sh\n');
    const result = collectSystemCron();
    expect(result.jobs[0].schedule).toBe('every 1h');
  });

  it('parses @weekly entry', () => {
    vi.mocked(execSync).mockReturnValue('@weekly /usr/bin/report.sh\n');
    const result = collectSystemCron();
    expect(result.jobs[0].schedule).toBe('weekly Sun');
  });

  it('parses @monthly entry', () => {
    vi.mocked(execSync).mockReturnValue('@monthly /usr/bin/invoice.sh\n');
    const result = collectSystemCron();
    expect(result.jobs[0].schedule).toBe('monthly 1st');
  });

  // --- Sorting ---

  it('sorts jobs by nextRun ascending, nulls last', () => {
    vi.mocked(execSync).mockReturnValue([
      '@reboot /usr/bin/startup.sh',       // nextRun: null
      '*/5 * * * * /usr/bin/frequent.sh',  // nextRun: soon
      '0 2 * * * /usr/bin/nightly.sh',     // nextRun: later
    ].join('\n') + '\n');
    const result = collectSystemCron();
    const nonNull = result.jobs.filter(j => j.nextRun !== null);
    const nulls = result.jobs.filter(j => j.nextRun === null);
    // All jobs with nextRun should come before nulls
    expect(result.jobs.indexOf(nonNull[0])).toBeLessThan(result.jobs.indexOf(nulls[0]));
    // Non-null jobs should be sorted ascending
    for (let i = 1; i < nonNull.length; i++) {
      expect(nonNull[i].nextRun!).toBeGreaterThanOrEqual(nonNull[i - 1].nextRun!);
    }
  });

  // --- Multiple entries ---

  it('parses multiple cron entries', () => {
    vi.mocked(execSync).mockReturnValue([
      '0 9 * * 1 /usr/bin/weekly-report.sh',
      '*/15 * * * * /usr/bin/health-check.sh',
      '# comment',
      'SHELL=/bin/sh',
    ].join('\n') + '\n');
    const result = collectSystemCron();
    expect(result.jobs).toHaveLength(2);
  });
});
