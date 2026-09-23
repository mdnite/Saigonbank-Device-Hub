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

  it('không gửi currentUserId khi chưa tick "đã cấp phát"', async () => {
    await new HttpDeviceRepository().create(
      draft({ allocated: false, currentUserId: 7, allocatedOn: '2026-09-22' }),
    );
    const body = sentBody(fetchMock);
    expect(body).not.toHaveProperty('currentUserId');
    expect(body).not.toHaveProperty('allocatedOn');
  });

  it('gửi currentUserId khi đã tick "đã cấp phát"', async () => {
    await new HttpDeviceRepository().create(draft({ allocated: true, currentUserId: 7 }));
    expect(sentBody(fetchMock).currentUserId).toBe(7);
  });

  it('purge: gọi POST /devices/purge với ids, trả về count', async () => {
    fetchMock.mockImplementation(async () => envelope({ count: 2 }));
    const count = await new HttpDeviceRepository().purge([1, 2]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/devices/purge');
    expect(sentBody(fetchMock)).toEqual({ ids: [1, 2] });
    expect(count).toBe(2);
  });
});
