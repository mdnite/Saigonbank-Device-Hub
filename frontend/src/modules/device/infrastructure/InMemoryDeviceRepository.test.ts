import { describe, expect, it } from 'vitest';
import { emptyAssetDraft } from '../domain/assetDraft';
import { InMemoryDeviceRepository } from './InMemoryDeviceRepository';

describe('InMemoryDeviceRepository', () => {
  it('filters by status', async () => {
    const repo = new InMemoryDeviceRepository();
    const rows = await repo.list({ status: 'PENDING_DISPOSAL' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((d) => d.status === 'PENDING_DISPOSAL')).toBe(true);
  });

  it('searches across id and name, case-insensitively', async () => {
    const repo = new InMemoryDeviceRepository();
    expect(await repo.list({ search: 'dell-003' })).toHaveLength(1);
    expect((await repo.list({ search: 'LATITUDE' })).length).toBeGreaterThan(1);
  });

  it('prepends a created device and returns it in later lists', async () => {
    const repo = new InMemoryDeviceRepository();
    const before = (await repo.list()).length;
    const created = await repo.create({
      ...emptyAssetDraft(),
      deviceCode: 'NEW-001',
      deviceName: 'Test Unit',
      specDetail: 'Intel',
      allocated: true,
      employee: 'Nguyễn Văn X',
    });
    expect(created.status).toBe('ALLOCATED');
    const after = await repo.list();
    expect(after).toHaveLength(before + 1);
    expect(after[0].id).toBe('NEW-001');
  });
});
