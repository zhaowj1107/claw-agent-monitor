import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseRollout, findRolloutFiles } from './codexSession.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function e(type: string, payload: object): string {
  return JSON.stringify({ type, payload });
}

// ---------------------------------------------------------------------------
// parseRollout
// ---------------------------------------------------------------------------
describe('parseRollout', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'codex-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for a missing file', () => {
    expect(parseRollout('/nonexistent/rollout.jsonl', Date.now())).toBeNull();
  });

  it('returns null for an empty file', () => {
    const file = join(tmpDir, 'rollout-2026-01-01T00-00-00-abc.jsonl');
    writeFileSync(file, '');
    expect(parseRollout(file, Date.now())).toBeNull();
  });

  it('returns null when there are no meaningful events', () => {
    const file = join(tmpDir, 'rollout-2026-01-01T00-00-00-abc.jsonl');
    writeFileSync(file, '   \n\n');
    expect(parseRollout(file, Date.now())).toBeNull();
  });

  it('sets the prompt from the first user_message', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'Hello Codex' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.prompt).toBe('Hello Codex');
    expect(result!.steps[0]).toMatchObject({ type: 'user_message', text: 'Hello Codex' });
  });

  it('only uses the first user_message as the prompt', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'First prompt' }),
      e('event_msg', { type: 'user_message', message: 'Second prompt' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.prompt).toBe('First prompt');
    expect(result!.steps).toHaveLength(2);
  });

  it('parses agent_reasoning steps', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
      e('event_msg', { type: 'agent_reasoning', text: 'Thinking about it...' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'agent_reasoning', text: 'Thinking about it...' });
  });

  it('skips empty agent_reasoning text', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
      e('event_msg', { type: 'agent_reasoning', text: '   ' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.steps.filter(s => s.type === 'agent_reasoning')).toHaveLength(0);
  });

  it('parses agent_message steps', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
      e('event_msg', { type: 'agent_message', message: 'Working on it...' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'agent_message', text: 'Working on it...' });
  });

  it('parses function_call steps', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
      e('response_item', { type: 'function_call', name: 'shell_command', arguments: '{"cmd":"ls"}', call_id: 'c1' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.steps).toContainEqual({
      type: 'function_call',
      name: 'shell_command',
      arguments: '{"cmd":"ls"}',
      callId: 'c1',
    });
  });

  it('parses function_call_output steps', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
      e('response_item', { type: 'function_call_output', call_id: 'c1', output: 'file.txt\ndir/' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.steps).toContainEqual({
      type: 'function_call_output',
      callId: 'c1',
      output: 'file.txt\ndir/',
    });
  });

  it('parses assistant message content blocks', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
      e('response_item', {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Done!' }],
      }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'assistant_message', text: 'Done!' });
  });

  it('detects agent initiator from session_meta with source=exec', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      JSON.stringify({ type: 'session_meta', payload: { source: 'exec' } }),
      e('event_msg', { type: 'user_message', message: 'task' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.initiator).toBe('agent');
  });

  it('defaults to user initiator when no session_meta', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.initiator).toBe('user');
  });

  it('defaults to user initiator when session_meta source is cli', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      JSON.stringify({ type: 'session_meta', payload: { source: 'cli' } }),
      e('event_msg', { type: 'user_message', message: 'task' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.initiator).toBe('user');
  });

  it('extracts ISO timestamp from rollout filename', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-45-someuuid.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.startedAt).toBe('2026-01-15T10:30:45Z');
  });

  it('falls back to current ISO string when filename has no timestamp', () => {
    const file = join(tmpDir, 'unknown-format.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('skips malformed JSON lines without crashing', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      'this is not json',
      '{"broken":',
      e('event_msg', { type: 'user_message', message: 'valid' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.prompt).toBe('valid');
  });

  it('sets tool to codex', () => {
    const file = join(tmpDir, 'rollout-2026-01-15T10-30-00-abc.jsonl');
    writeFileSync(file, [
      e('event_msg', { type: 'user_message', message: 'task' }),
    ].join('\n'));
    const result = parseRollout(file, Date.now());
    expect(result!.tool).toBe('codex');
  });
});

// ---------------------------------------------------------------------------
// findRolloutFiles
// ---------------------------------------------------------------------------
describe('findRolloutFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'codex-find-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when root does not exist', () => {
    expect(findRolloutFiles('/nonexistent/path')).toEqual([]);
  });

  it('returns empty array when directory is empty', () => {
    expect(findRolloutFiles(tmpDir)).toEqual([]);
  });

  it('finds rollout jsonl files nested in YYYY/MM/DD structure', () => {
    const dayDir = join(tmpDir, '2026', '01', '15');
    mkdtempSync; // just to confirm import is fine
    // Create the nested directory manually
    const { mkdirSync } = require('fs');
    mkdirSync(dayDir, { recursive: true });
    writeFileSync(join(dayDir, 'rollout-2026-01-15T10-00-00-abc.jsonl'), '');
    writeFileSync(join(dayDir, 'rollout-2026-01-15T11-00-00-def.jsonl'), '');

    const files = findRolloutFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files[0].path).toContain('rollout-');
  });

  it('ignores non-rollout files', () => {
    const dayDir = join(tmpDir, '2026', '01', '15');
    const { mkdirSync } = require('fs');
    mkdirSync(dayDir, { recursive: true });
    writeFileSync(join(dayDir, 'rollout-2026-01-15T10-00-00-abc.jsonl'), '');
    writeFileSync(join(dayDir, 'other-file.jsonl'), '');
    writeFileSync(join(dayDir, 'rollout-notes.txt'), '');

    const files = findRolloutFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0].path).toContain('rollout-');
  });

  it('respects the limit parameter', () => {
    const dayDir = join(tmpDir, '2026', '01', '15');
    const { mkdirSync } = require('fs');
    mkdirSync(dayDir, { recursive: true });
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(dayDir, `rollout-2026-01-15T${String(i).padStart(2, '0')}-00-00-x.jsonl`), '');
    }

    const files = findRolloutFiles(tmpDir, 3);
    expect(files).toHaveLength(3);
  });
});
