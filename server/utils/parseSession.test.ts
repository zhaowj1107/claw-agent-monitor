import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync, utimesSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseSession, formatElapsed } from './parseSession.js';

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------
describe('formatElapsed', () => {
  it('formats zero seconds', () => {
    expect(formatElapsed(0)).toBe('0m 00s');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsed(125)).toBe('2m 05s');
  });

  it('formats exactly one minute', () => {
    expect(formatElapsed(60)).toBe('1m 00s');
  });

  it('clamps negative values to zero', () => {
    expect(formatElapsed(-10)).toBe('0m 00s');
  });

  it('formats large values (one hour)', () => {
    expect(formatElapsed(3600)).toBe('60m 00s');
  });
});

// ---------------------------------------------------------------------------
// parseSession
// ---------------------------------------------------------------------------
describe('parseSession', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-parse-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for a non-existent file', () => {
    expect(parseSession('/nonexistent/path.jsonl')).toBeNull();
  });

  it('returns null for an empty file', () => {
    const file = join(tmpDir, 'empty.jsonl');
    writeFileSync(file, '');
    expect(parseSession(file)).toBeNull();
  });

  it('returns null when file contains only whitespace', () => {
    const file = join(tmpDir, 'blank.jsonl');
    writeFileSync(file, '   \n\n  ');
    expect(parseSession(file)).toBeNull();
  });

  it('extracts label from a string-content user message', () => {
    const lines = [
      JSON.stringify({ type: 'session', timestamp: new Date().toISOString() }),
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'Write a Python script' } }),
    ].join('\n');
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Write a Python script');
  });

  it('extracts label from array-content user message', () => {
    const lines = [
      JSON.stringify({
        type: 'message',
        message: { role: 'user', content: [{ type: 'text', text: 'Add unit tests' }] },
      }),
    ].join('\n');
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.label).toBe('Add unit tests');
  });

  it('truncates long labels to 40 chars with ellipsis', () => {
    const longText = 'A'.repeat(50);
    const lines = [
      JSON.stringify({ type: 'message', message: { role: 'user', content: longText } }),
    ].join('\n');
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.label.length).toBeLessThanOrEqual(40);
    expect(result!.label.endsWith('...')).toBe(true);
  });

  it('counts top-level tool calls correctly', () => {
    const lines = [
      JSON.stringify({ type: 'toolCall', name: 'Read', arguments: { file_path: '/tmp/a' } }),
      JSON.stringify({ type: 'toolCall', name: 'Write', arguments: { file_path: '/tmp/b', content: 'hello' } }),
    ].join('\n');
    const file = join(tmpDir, 'tools.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.toolCount).toBe(2);
    expect(result!.currentTool).toBe('Write');
    expect(result!.recentTools).toEqual(['Read', 'Write']);
  });

  it('limits recentTools to last 5 calls', () => {
    const toolNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const lines = toolNames.map(name =>
      JSON.stringify({ type: 'toolCall', name, arguments: {} })
    ).join('\n');
    const file = join(tmpDir, 'many-tools.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.recentTools).toHaveLength(5);
    expect(result!.recentTools).toEqual(['T3', 'T4', 'T5', 'T6', 'T7']);
  });

  it('skips sensitive keys when formatting tool args', () => {
    const lines = [
      JSON.stringify({
        type: 'toolCall',
        name: 'ApiCall',
        arguments: { token: 'supersecret', url: 'https://api.example.com' },
      }),
    ].join('\n');
    const file = join(tmpDir, 'sensitive.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.toolArgs).not.toContain('supersecret');
    expect(result!.toolArgs).toContain('api.example.com');
  });

  it('marks session as running when file was modified recently', () => {
    const lines = [
      JSON.stringify({ type: 'session', timestamp: new Date().toISOString() }),
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'task' } }),
    ].join('\n');
    const file = join(tmpDir, 'running.jsonl');
    writeFileSync(file, lines);
    // File mtime is "now" by default
    const result = parseSession(file);
    expect(result!.status).toBe('running');
  });

  it('marks session as complete when file is older than 30 seconds', () => {
    const lines = [
      JSON.stringify({ type: 'session', timestamp: new Date(Date.now() - 120_000).toISOString() }),
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'task' } }),
    ].join('\n');
    const file = join(tmpDir, 'complete.jsonl');
    writeFileSync(file, lines);
    // Set mtime to 2 minutes ago
    const old = new Date(Date.now() - 120_000);
    utimesSync(file, old, old);
    const result = parseSession(file);
    expect(result!.status).toBe('complete');
  });

  it('marks session as failed when tool result contains an error and file is old', () => {
    const lines = [
      JSON.stringify({ type: 'session', timestamp: new Date(Date.now() - 120_000).toISOString() }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'toolResult',
          content: [{ text: '{"error": "command not found"}' }],
        },
      }),
    ].join('\n');
    const file = join(tmpDir, 'failed.jsonl');
    writeFileSync(file, lines);
    const old = new Date(Date.now() - 120_000);
    utimesSync(file, old, old);
    const result = parseSession(file);
    expect(result!.status).toBe('failed');
    expect(result!.errorDetails).not.toBeNull();
  });

  it('skips malformed JSON lines without crashing', () => {
    const lines = [
      'not-valid-json',
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'valid task' } }),
    ].join('\n');
    const file = join(tmpDir, 'malformed.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result).not.toBeNull();
    expect(result!.label).toBe('valid task');
  });

  it('uses session timestamp for startTime when present', () => {
    const ts = new Date(Date.now() - 300_000).toISOString(); // 5 minutes ago
    const lines = [
      JSON.stringify({ type: 'session', timestamp: ts }),
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'task' } }),
    ].join('\n');
    const file = join(tmpDir, 'timed.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.elapsed).toBeGreaterThanOrEqual(280); // ~5 minutes
  });

  it('extracts tool calls from assistant message content array', () => {
    const lines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [{ type: 'toolCall', toolCall: { name: 'Bash', arguments: { command: 'ls' } } }],
        },
      }),
    ].join('\n');
    const file = join(tmpDir, 'assistant-tool.jsonl');
    writeFileSync(file, lines);
    const result = parseSession(file);
    expect(result!.toolCount).toBe(1);
    expect(result!.currentTool).toBe('Bash');
  });
});
