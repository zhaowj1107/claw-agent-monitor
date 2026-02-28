import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseClaudeCodeSession } from './claudeCodeSession.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function entry(type: 'user' | 'assistant', content: unknown, extra: object = {}): string {
  return JSON.stringify({ type, message: { content }, ...extra });
}

// ---------------------------------------------------------------------------
// parseClaudeCodeSession
// ---------------------------------------------------------------------------
describe('parseClaudeCodeSession', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for a missing file', () => {
    expect(parseClaudeCodeSession('/nonexistent.jsonl', Date.now())).toBeNull();
  });

  it('returns null for an empty file', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, '');
    expect(parseClaudeCodeSession(file, Date.now())).toBeNull();
  });

  it('returns null when no meaningful content is found', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, JSON.stringify({ type: 'file-history-snapshot' }));
    expect(parseClaudeCodeSession(file, Date.now())).toBeNull();
  });

  it('extracts prompt from a string-content user message', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'Fix the auth bug', { parentUuid: null, timestamp: '2026-01-15T10:30:00Z', cwd: '/project' }),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.prompt).toBe('Fix the auth bug');
    expect(result!.tool).toBe('claude-code');
  });

  it('extracts cwd from the first entry that has it', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task', { cwd: '/my/project' }),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.cwd).toBe('/my/project');
  });

  it('extracts startedAt from the first entry with parentUuid === null', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task', { parentUuid: null, timestamp: '2026-01-15T10:30:00Z' }),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.startedAt).toBe('2026-01-15T10:30:00Z');
  });

  it('extracts prompt from array text-content user message', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', [{ type: 'text', text: 'Add unit tests' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.prompt).toBe('Add unit tests');
  });

  it('concatenates multiple text blocks in array content', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' World' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.prompt).toBe('Hello World');
  });

  it('parses thinking blocks as agent_reasoning steps', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task'),
      entry('assistant', [{ type: 'thinking', thinking: 'Reasoning about this...' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'agent_reasoning', text: 'Reasoning about this...' });
  });

  it('parses tool_use blocks as function_call steps', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task'),
      entry('assistant', [{ type: 'tool_use', name: 'Read', input: { file_path: '/foo.ts' }, id: 'tu1' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps).toContainEqual({
      type: 'function_call',
      name: 'Read',
      arguments: '{"file_path":"/foo.ts"}',
      callId: 'tu1',
    });
  });

  it('serializes tool_use string input directly', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task'),
      entry('assistant', [{ type: 'tool_use', name: 'Bash', input: '{"command":"ls"}', id: 'tu2' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    const fc = result!.steps.find(s => s.type === 'function_call');
    expect(fc!.arguments).toBe('{"command":"ls"}');
  });

  it('parses text blocks as assistant_message steps', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task'),
      entry('assistant', [{ type: 'text', text: 'Done! All tests pass.' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'assistant_message', text: 'Done! All tests pass.' });
  });

  it('parses tool_result user messages as function_call_output steps', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', [
        { type: 'tool_result', tool_use_id: 'tu1', content: [{ type: 'text', text: 'file contents here' }] },
      ]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps).toContainEqual({
      type: 'function_call_output',
      callId: 'tu1',
      output: 'file contents here',
    });
  });

  it('handles tool_result with string content', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', [
        { type: 'tool_result', tool_use_id: 'tu2', content: 'simple string output' },
      ]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    const output = result!.steps.find(s => s.type === 'function_call_output');
    expect(output!.output).toBe('simple string output');
  });

  it('skips file-history-snapshot entries', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      JSON.stringify({ type: 'file-history-snapshot', files: ['a.ts'] }),
      entry('user', 'actual task'),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps.filter(s => s.type === 'user_message')).toHaveLength(1);
  });

  it('skips summary entries', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      JSON.stringify({ type: 'summary', content: 'some summary' }),
      entry('user', 'real task'),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps.filter(s => s.type === 'user_message')).toHaveLength(1);
  });

  it('skips empty thinking blocks', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      entry('user', 'task'),
      entry('assistant', [{ type: 'thinking', thinking: '   ' }]),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.steps.filter(s => s.type === 'agent_reasoning')).toHaveLength(0);
  });

  it('skips malformed JSON lines without crashing', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [
      'not json at all',
      entry('user', 'valid task'),
    ].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.prompt).toBe('valid task');
  });

  it('sets initiator to user (claude-code always user-initiated)', () => {
    const file = join(tmpDir, 'session.jsonl');
    writeFileSync(file, [entry('user', 'task')].join('\n'));
    const result = parseClaudeCodeSession(file, Date.now());
    expect(result!.initiator).toBe('user');
  });
});
