import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOrderDraft, type OrderDraft } from '../domain/validateOrderDraft';
import { HttpDeviceOrderRepository } from './HttpDeviceOrderRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  ...emptyOrderDraft(),
  type: 'Cấp phát',
  targetUserId: 7,
  deviceIds: [1, 2],
  ...over,
});

describe('HttpDeviceOrderRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('create: gửi type/targetUserId/deviceIds, bỏ note rỗng', async () => {
    await new HttpDeviceOrderRepository().create(draft());
    expect(sentBody(fetchMock)).toEqual({ type: 'Cấp phát', targetUserId: 7, deviceIds: [1, 2] });
  });

  it('create: giữ note khi có nội dung', async () => {
    await new HttpDeviceOrderRepository().create(draft({ note: '  Ưu tiên gấp  ' }));
    expect(sentBody(fetchMock).note).toBe('Ưu tiên gấp');
  });

  it('approve: gọi PATCH /device-orders/:id/approve, không gửi body', async () => {
    await new HttpDeviceOrderRepository().approve(5);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/5/approve');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });

  it('reject: gửi reason', async () => {
    await new HttpDeviceOrderRepository().reject(5, 'Không đủ thiết bị');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/5/reject');
    expect(sentBody(fetchMock)).toEqual({ reason: 'Không đủ thiết bị' });
  });

  it('list: gọi GET /device-orders với query type', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceOrderRepository().list({ type: 'Cấp phát' });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/device-orders');
    expect(url.searchParams.get('type')).toBe('Cấp phát');
  });

  it('users: gọi GET /users/lookup', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceOrderRepository().users();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users/lookup');
  });

  it('remove: gọi DELETE /device-orders/:id', async () => {
    await new HttpDeviceOrderRepository().remove(5);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/5');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('purge: POST /device-orders/purge với ids', async () => {
    fetchMock.mockImplementation(async () => envelope({ count: 2 }));
    const res = await new HttpDeviceOrderRepository().purge([3, 4]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/purge');
    expect(sentBody(fetchMock)).toEqual({ ids: [3, 4] });
    expect(res).toEqual({ count: 2 });
  });

  it('departments: gọi GET /departments', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceOrderRepository().departments();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/departments');
  });
});
