import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyTransferDraft, type TransferDraft } from '../domain/validateTransferDraft';
import { HttpDeviceTransferRepository } from './HttpDeviceTransferRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

const draft = (over: Partial<TransferDraft> = {}): TransferDraft => ({
  ...emptyTransferDraft(),
  fromUserId: 5,
  toUserId: 7,
  deviceIds: [1, 2],
  ...over,
});

describe('HttpDeviceTransferRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('create: gửi fromUserId/toUserId/deviceIds, bỏ note rỗng', async () => {
    await new HttpDeviceTransferRepository().create(draft());
    expect(sentBody(fetchMock)).toEqual({ fromUserId: 5, toUserId: 7, deviceIds: [1, 2] });
  });

  it('create: giữ note khi có nội dung', async () => {
    await new HttpDeviceTransferRepository().create(draft({ note: '  Gấp  ' }));
    expect(sentBody(fetchMock).note).toBe('Gấp');
  });

  it('approve: gọi PATCH /device-transfers/:id/approve, không gửi body', async () => {
    await new HttpDeviceTransferRepository().approve(5);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-transfers/5/approve');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });

  it('reject: gửi reason', async () => {
    await new HttpDeviceTransferRepository().reject(5, 'Không đủ điều kiện');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-transfers/5/reject');
    expect(sentBody(fetchMock)).toEqual({ reason: 'Không đủ điều kiện' });
  });

  it('list: gọi GET /device-transfers với query status', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceTransferRepository().list({ status: 'Chờ duyệt' });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/device-transfers');
    expect(url.searchParams.get('status')).toBe('Chờ duyệt');
  });

  it('users: gọi GET /users/lookup', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceTransferRepository().users();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users/lookup');
  });
});
