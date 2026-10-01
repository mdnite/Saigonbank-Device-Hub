import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDeviceDraft, type DeviceDraft } from '../domain/deviceDraft';
import { HttpDeviceRepository, toBody } from './HttpDeviceRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** Body JSON mà fetch đã nhận ở lần gọi gần nhất. */
const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

const draft = (over: Partial<DeviceDraft> = {}): DeviceDraft => ({
  ...emptyDeviceDraft(),
  deviceCode: 'lt-000001',
  deviceName: 'Dell Latitude 5420',
  specDetail: 'i5 · 16GB',
  unit: 'Cái',
  deviceTypeId: 1,
  ...over,
});

describe('toBody', () => {
  it('bỏ hẳn các trường tuỳ chọn chỉ có khoảng trắng', () => {
    const body = toBody(
      draft({ serialNumber: '   ', location: '', supplier: '  ', warrantyMonths: '  ' }),
    );
    expect(body.serialNumber).toBeUndefined();
    expect(body.location).toBeUndefined();
    expect(body.supplier).toBeUndefined();
    expect(body.warrantyMonths).toBeUndefined();
  });

  it('cắt khoảng trắng và viết hoa mã thiết bị, đổi số tháng bảo hành sang number', () => {
    const body = toBody(draft({ deviceCode: '  lt-000001  ', warrantyMonths: '24' }));
    expect(body.deviceCode).toBe('LT-000001');
    expect(body.warrantyMonths).toBe(24);
  });
});

describe('HttpDeviceRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('gửi mã thiết bị dạng chữ hoa', async () => {
    await new HttpDeviceRepository().create(draft());
    expect(sentBody(fetchMock).deviceCode).toBe('LT-000001');
  });

  it('bỏ các trường rỗng khỏi body', async () => {
    await new HttpDeviceRepository().create(draft({ serialNumber: '   ' }));
    expect(sentBody(fetchMock)).not.toHaveProperty('serialNumber');
  });

  it('không bao giờ gửi người giữ / ngày cấp / phòng ban / trạng thái', async () => {
    await new HttpDeviceRepository().create(draft());
    const body = sentBody(fetchMock);
    for (const key of ['currentUserId', 'allocatedOn', 'departmentId', 'status']) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it('purge: gọi POST /devices/purge với ids, trả về count', async () => {
    fetchMock.mockImplementation(async () => envelope({ count: 2 }));
    const count = await new HttpDeviceRepository().purge([1, 2]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/devices/purge');
    expect(sentBody(fetchMock)).toEqual({ ids: [1, 2] });
    expect(count).toBe(2);
  });

  it('list: truyền currentUserId qua query string', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceRepository().list({ currentUserId: 7 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('currentUserId')).toBe('7');
  });
});
