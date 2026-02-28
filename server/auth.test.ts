// server/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkAuth, extractToken } from './auth.js';

describe('extractToken', () => {
  it('extracts Bearer token from Authorization header', () => {
    expect(extractToken({ authorization: 'Bearer abc123' }, null)).toBe('abc123');
  });

  it('extracts token from ?token= query string', () => {
    expect(extractToken({}, '?token=abc123')).toBe('abc123');
  });

  it('returns null when no token present', () => {
    expect(extractToken({}, null)).toBeNull();
  });
});

describe('checkAuth', () => {
  beforeEach(() => { process.env.CLAW_TOKEN = 'secret'; });
  afterEach(() => { delete process.env.CLAW_TOKEN; });

  it('returns true when token matches', () => {
    expect(checkAuth('secret')).toBe(true);
  });

  it('returns false when token does not match', () => {
    expect(checkAuth('wrong')).toBe(false);
  });

  it('returns true when no CLAW_TOKEN set (no-auth mode)', () => {
    delete process.env.CLAW_TOKEN;
    expect(checkAuth(null)).toBe(true);
  });
});
