import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiGet, apiPost, configureApiSession } from './apiClient';

function stubFetch(status: number, envelope: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const ok = (data: unknown) => ({ success: true, data, error: null, message: 'Thành công' });
const expired = {
  success: false,
  data: null,
  error: 'UNAUTHORIZED',
  message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
};

const onUnauthorized = vi.fn();
let token: string | null = null;

beforeEach(() => {
  token = null;
  onUnauthorized.mockReset();
  configureApiSession({ getToken: () => token, onUnauthorized });
});
afterEach(() => vi.unstubAllGlobals());

it('có token: gửi header Authorization Bearer', async () => {
  token = 'jwt-abc';
  const fetchMock = stubFetch(200, ok([]));
  await apiGet('/users');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer jwt-abc' });
});

it('không token: không gửi Authorization', async () => {
  const fetchMock = stubFetch(200, ok(null));
  await apiPost('/auth/login', { identifier: 'a', password: 'b' });
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});

it('401 trên request có token: gọi onUnauthorized và vẫn ném message BE', async () => {
  token = 'jwt-old';
  stubFetch(401, expired);
  await expect(apiGet('/users')).rejects.toThrow(expired.message);
  expect(onUnauthorized).toHaveBeenCalledOnce();
});

it('401 khi chưa có token (sai mật khẩu): không gọi onUnauthorized', async () => {
  stubFetch(401, { ...expired, message: 'Sai tên đăng nhập hoặc mật khẩu' });
  await expect(apiPost('/auth/login', {})).rejects.toThrow('Sai tên đăng nhập hoặc mật khẩu');
  expect(onUnauthorized).not.toHaveBeenCalled();
});

it('apiGet dựng query, bỏ giá trị rỗng/undefined', async () => {
  const fetchMock = stubFetch(200, ok([]));
  await apiGet('/users', { search: 'an', status: '', roleId: 2, departmentId: undefined });
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users?search=an&roleId=2');
});

it('onUnauthorized ném lỗi: vẫn ném đúng message của BE', async () => {
  token = 'jwt-old';
  onUnauthorized.mockImplementation(() => {
    throw new Error('signOut lỗi');
  });
  stubFetch(401, expired);
  await expect(apiGet('/users')).rejects.toThrow(expired.message);
});
