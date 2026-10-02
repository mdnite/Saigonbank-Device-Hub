import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAuditDraft } from '../domain/validateAuditDraft';
import { HttpAuditRepository } from './HttpAuditRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const call = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined };
};

describe('HttpAuditRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const repo = new HttpAuditRepository();

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('create: đơn vị "KHO" gửi departmentId null, bỏ ô tuỳ chọn rỗng', async () => {
    await repo.create({ ...emptyAuditDraft(), unit: 'KHO', dueDate: '2026-10-31', purpose: 'Định kỳ' });
    expect(call(fetchMock)).toEqual({
      url: 'http://localhost:3000/audits',
      method: 'POST',
      body: { departmentId: null, dueDate: '2026-10-31', purpose: 'Định kỳ', memberIds: [] },
    });
  });

  it('create: phòng ban + loại + vị trí + thành viên', async () => {
    await repo.create({
      unit: '2',
      dueDate: '2026-10-31',
      purpose: 'Cuối năm',
      deviceTypeId: '1',
      location: 'Tầng 3',
      memberIds: [4, 5],
    });
    expect(call(fetchMock).body).toEqual({
      departmentId: 2,
      dueDate: '2026-10-31',
      purpose: 'Cuối năm',
      deviceTypeId: 1,
      location: 'Tầng 3',
      memberIds: [4, 5],
    });
  });

  it('setMembers: PUT /audits/:id/members', async () => {
    await repo.setMembers(3, [7]);
    expect(call(fetchMock)).toEqual({
      url: 'http://localhost:3000/audits/3/members',
      method: 'PUT',
      body: { userIds: [7] },
    });
  });

  it('updateItem / updateAccessory: PATCH đúng đường dẫn', async () => {
    await repo.updateItem(3, 9, { result: 'Thiếu' });
    expect(call(fetchMock)).toEqual({
      url: 'http://localhost:3000/audits/3/items/9',
      method: 'PATCH',
      body: { result: 'Thiếu' },
    });
    fetchMock.mockClear();
    await repo.updateAccessory(3, 11, { note: '' });
    expect(call(fetchMock).url).toBe('http://localhost:3000/audits/3/accessories/11');
  });

  it('start / submit / approve: POST không body; reject gửi reason', async () => {
    await repo.approve(3);
    expect(call(fetchMock)).toEqual({ url: 'http://localhost:3000/audits/3/approve', method: 'POST', body: undefined });
    fetchMock.mockClear();
    await repo.reject(3, 'Đếm lại');
    expect(call(fetchMock).body).toEqual({ reason: 'Đếm lại' });
  });

  it('list: query status + q; createSummary: trim tiêu đề, bỏ mục đích rỗng', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await repo.list({ status: 'Đã duyệt', q: 'kho' });
    const url = new URL(call(fetchMock).url);
    expect(url.pathname).toBe('/audits');
    expect(url.searchParams.get('status')).toBe('Đã duyệt');
    expect(url.searchParams.get('q')).toBe('kho');
    fetchMock.mockClear();
    await repo.createSummary({ title: '  Quý 3 ', purpose: '', auditIds: [1, 2] });
    expect(call(fetchMock)).toEqual({
      url: 'http://localhost:3000/audit-summaries',
      method: 'POST',
      body: { title: 'Quý 3', auditIds: [1, 2] },
    });
  });
});
