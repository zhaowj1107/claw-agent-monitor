import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseGeminiSession } from './geminiSession.js';

describe('parseGeminiSession', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gemini-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for a non-existent file', () => {
    expect(parseGeminiSession('/nonexistent/session.json', Date.now())).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, 'not valid json');
    expect(parseGeminiSession(file, Date.now())).toBeNull();
  });

  it('returns null when messages array is empty', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({ messages: [] }));
    expect(parseGeminiSession(file, Date.now())).toBeNull();
  });

  it('returns null when there are no non-error messages with text', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({ messages: [{ type: 'error', content: 'boom' }] }));
    expect(parseGeminiSession(file, Date.now())).toBeNull();
  });

  it('extracts prompt from the first user message (string content)', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      startTime: '2026-01-15T10:30:00Z',
      messages: [
        { type: 'user', content: 'Write a test suite' },
        { type: 'model', content: 'Sure!' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.prompt).toBe('Write a test suite');
    expect(result!.tool).toBe('gemini');
    expect(result!.initiator).toBe('user');
  });

  it('uses startTime from the session object when present', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      startTime: '2026-01-15T10:30:00Z',
      messages: [{ type: 'user', content: 'task' }],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.startedAt).toBe('2026-01-15T10:30:00Z');
  });

  it('falls back to mtime when no startTime in session', () => {
    const mtime = Date.now() - 60_000;
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [{ type: 'user', content: 'task' }],
    }));
    const result = parseGeminiSession(file, mtime);
    expect(result!.startedAt).toBe(new Date(mtime).toISOString());
  });

  it('extracts text from array content', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [{ type: 'user', content: [{ text: 'Array content task' }] }],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.prompt).toBe('Array content task');
  });

  it('concatenates multiple text parts in array content', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [{ type: 'user', content: [{ text: 'Hello ' }, { text: 'World' }] }],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.prompt).toBe('Hello World');
  });

  it('skips error-type messages', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [
        { type: 'error', content: 'connection failed' },
        { type: 'user', content: 'retry task' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.prompt).toBe('retry task');
    expect(result!.steps.filter(s => s.type === 'user_message')).toHaveLength(1);
  });

  it('maps model messages to assistant_message steps', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [
        { type: 'user', content: 'task' },
        { type: 'model', content: 'Here is my response' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'assistant_message', text: 'Here is my response' });
  });

  it('maps assistant messages to assistant_message steps', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [
        { type: 'user', content: 'task' },
        { type: 'assistant', content: 'Response from assistant' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'assistant_message', text: 'Response from assistant' });
  });

  it('maps info messages to assistant_message steps', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [
        { type: 'user', content: 'task' },
        { type: 'info', content: 'Tool output info' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.steps).toContainEqual({ type: 'assistant_message', text: 'Tool output info' });
  });

  it('records all steps in order', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [
        { type: 'user', content: 'first' },
        { type: 'model', content: 'reply' },
        { type: 'user', content: 'follow-up' },
        { type: 'model', content: 'second reply' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.steps).toHaveLength(4);
    expect(result!.steps[0]).toMatchObject({ type: 'user_message', text: 'first' });
    expect(result!.steps[1]).toMatchObject({ type: 'assistant_message', text: 'reply' });
  });

  it('skips messages with no text content', () => {
    const file = join(tmpDir, 'session.json');
    writeFileSync(file, JSON.stringify({
      messages: [
        { type: 'user', content: '' },
        { type: 'user', content: 'valid task' },
      ],
    }));
    const result = parseGeminiSession(file, Date.now());
    expect(result!.steps.filter(s => s.type === 'user_message')).toHaveLength(1);
    expect(result!.prompt).toBe('valid task');
  });
});
