// server/collectors/subAgents.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock the fs module
vi.mock('fs');

describe('collectSubAgents', () => {
  it('returns empty array when sessions dir does not exist', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { collectSubAgents } = await import('./subAgents.js');
    const result = collectSubAgents();
    expect(result).toEqual([]);
  });
});
