import { describe, it, expect, vi, beforeEach } from 'vitest';
import { manageBlacklist } from '../src/blacklist.ts';
import * as configDb from '../src/lib/config-db.ts';

vi.mock('../src/lib/config-db.ts', () => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

describe('manageBlacklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add a user to the blacklist', async () => {
    const mockConfig = { blacklistedAuthors: [] };
    vi.mocked(configDb.getConfig).mockResolvedValue(mockConfig);

    await manageBlacklist('add', 'malicious-user');

    expect(configDb.saveConfig).toHaveBeenCalledWith({
      blacklistedAuthors: ['malicious-user'],
    });
  });

  it('should remove a user from the blacklist', async () => {
    const mockConfig = { blacklistedAuthors: ['malicious-user', 'other'] };
    vi.mocked(configDb.getConfig).mockResolvedValue(mockConfig);

    await manageBlacklist('remove', 'malicious-user');

    expect(configDb.saveConfig).toHaveBeenCalledWith({
      blacklistedAuthors: ['other'],
    });
  });

  it('should not add a user if already blacklisted', async () => {
    const mockConfig = { blacklistedAuthors: ['malicious-user'] };
    vi.mocked(configDb.getConfig).mockResolvedValue(mockConfig);

    await manageBlacklist('add', 'malicious-user');

    expect(configDb.saveConfig).not.toHaveBeenCalled();
  });
});
