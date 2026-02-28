import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { collectCodingAgents } from './codingAgents.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// ps aux header line (macOS format)
const HEADER = 'USER               PID  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND';

// Build a plausible ps aux line with 11+ fields
function psLine(pid: number, ...cmd: string[]): string {
  return `silvia ${pid} 0.5 1.0 4000000 99000 ?? S 10:00AM 0:01.23 ${cmd.join(' ')}`;
}

describe('collectCodingAgents', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('returns empty array when ps aux throws', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('ps failed'); });
    expect(collectCodingAgents()).toEqual([]);
  });

  it('returns empty array when output has only the header', () => {
    vi.mocked(execSync).mockReturnValue(HEADER + '\n');
    expect(collectCodingAgents()).toEqual([]);
  });

  // --- Claude Code detection ---

  it('detects a Claude Code process', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, '/usr/local/bin/claude', '--dangerously-skip-permissions')
    );
    const agents = collectCodingAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].type).toBe('CC');
    expect(agents[0].pid).toBe(1234);
  });

  it('detects claude binary anywhere in PATH', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(999, '/home/user/.local/bin/claude', '--dangerously-skip-permissions')
    );
    const agents = collectCodingAgents();
    expect(agents[0].type).toBe('CC');
  });

  // --- Codex detection ---

  it('detects a Codex process', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(5678, '/usr/local/bin/codex', 'fix the auth bug')
    );
    const agents = collectCodingAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].type).toBe('Codex');
    expect(agents[0].pid).toBe(5678);
  });

  // --- GitHub Copilot detection ---

  it('detects a GitHub Copilot process', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(4321, '/usr/local/bin/gh', 'copilot', 'explain', 'code.ts')
    );
    const agents = collectCodingAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].type).toBe('GHCP');
  });

  // --- Credential redaction ---

  it('redacts --api-key flag values', () => {
    // Use short flags so the redacted command stays under the 45-char truncation limit
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'claude', '--dangerously', '--api-key=supersecret123')
    );
    const agents = collectCodingAgents();
    expect(agents[0].command).not.toContain('supersecret123');
    expect(agents[0].command).toContain('***');
  });

  it('redacts --token flag values', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'claude', '--dangerously-skip-permissions', '--token', 'mytoken')
    );
    const agents = collectCodingAgents();
    expect(agents[0].command).not.toContain('mytoken');
  });

  // --- Command truncation ---

  it('truncates command to 48 characters with ellipsis', () => {
    const longArg = '--dangerously-skip-permissions-with-extra-stuff-that-makes-it-very-long';
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'claude', longArg)
    );
    const agents = collectCodingAgents();
    expect(agents[0].command.length).toBeLessThanOrEqual(48);
  });

  // --- Deduplication ---

  it('deduplicates agents of the same type, keeping the lowest PID', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' +
      psLine(200, '/usr/local/bin/claude', '--dangerously-skip-permissions') + '\n' +
      psLine(100, '/usr/local/bin/claude', '--dangerously-skip-permissions')
    );
    const agents = collectCodingAgents();
    const ccAgents = agents.filter(a => a.type === 'CC');
    expect(ccAgents).toHaveLength(1);
    expect(ccAgents[0].pid).toBe(100);
  });

  it('does not deduplicate agents of different types', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' +
      psLine(1234, '/usr/local/bin/claude', '--dangerously-skip-permissions') + '\n' +
      psLine(5678, '/usr/local/bin/codex', 'task')
    );
    const agents = collectCodingAgents();
    expect(agents).toHaveLength(2);
  });

  // --- Exclusion of wrapper processes ---

  it('excludes sh -c wrapper processes', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'sh', '-c', 'claude', '--dangerously-skip-permissions')
    );
    expect(collectCodingAgents()).toHaveLength(0);
  });

  it('excludes bash -c wrapper processes', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'bash', '-c', 'claude', '--dangerously-skip-permissions')
    );
    expect(collectCodingAgents()).toHaveLength(0);
  });

  it('excludes sudo-prefixed processes', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'sudo', '/usr/local/bin/claude', '--dangerously-skip-permissions')
    );
    expect(collectCodingAgents()).toHaveLength(0);
  });

  it('excludes grep processes that mention agent names', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, 'grep', 'claude', '--dangerously-skip-permissions')
    );
    expect(collectCodingAgents()).toHaveLength(0);
  });

  // --- pid and elapsed fields ---

  it('sets elapsed from the TIME column (column index 9)', () => {
    vi.mocked(execSync).mockReturnValue(
      HEADER + '\n' + psLine(1234, '/usr/local/bin/claude', '--dangerously-skip-permissions').replace('0:01.23', '5:42.10')
    );
    const agents = collectCodingAgents();
    expect(agents[0].elapsed).toBe('5:42.10');
  });
});
