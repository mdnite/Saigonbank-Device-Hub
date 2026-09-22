import { afterEach, expect, it, vi } from 'vitest';
import { HttpAuthRepository } from './HttpAuthRepository';

const repo = new HttpAuthRepository();

/** Giả lập 1 response BE đã bọc envelope. */
function stubFetch(status: number, envelope: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(envelope), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse(fetchMock.mock.calls[0][1].body as string);

afterEach(() => vi.unstubAllGlobals());

it('login gửi identifier và map data BE sang AuthSession', async () => {
  const fetchMock = stubFetch(200, {
    success: true,
    data: {
      accessToken: 'jwt',
      user: { id: 7, fullName: 'Quản trị viên', email: 'a@b.vn', roleName: 'Quản trị viên', departmentCode: 'KYTHUAT' },
    },
    error: null,
    message: 'Đăng nhập thành công',
  });

  const session = await repo.login({ username: 'admin', password: 'Admin@123' });

  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/auth/login');
  expect(sentBody(fetchMock)).toEqual({ identifier: 'admin', password: 'Admin@123' });
  expect(session).toEqual({
    userId: '7',
    displayName: 'Quản trị viên',
    email: 'a@b.vn',
    token: 'jwt',
    roleName: 'Quản trị viên',
    departmentCode: 'KYTHUAT',
  });
});

it('lỗi từ BE: ném đúng message tiếng Việt trong envelope', async () => {
  stubFetch(401, {
    success: false,
    data: null,
    error: 'UNAUTHORIZED',
    message: 'Sai tên đăng nhập hoặc mật khẩu',
  });

  await expect(repo.login({ username: 'admin', password: 'sai-mk' })).rejects.toThrow(
    'Sai tên đăng nhập hoặc mật khẩu',
  );
});

it('không kết nối được máy chủ: ném message thân thiện', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

  await expect(repo.requestPasswordReset('a@b.vn')).rejects.toThrow(
    'Không kết nối được máy chủ, vui lòng thử lại sau',
  );
});

it('resetPassword gửi đủ email, otp, newPassword', async () => {
  const fetchMock = stubFetch(200, { success: true, data: null, error: null, message: 'OK' });

  await repo.resetPassword('a@b.vn', '1234', 'matkhau-moi');

  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/auth/reset-password');
  expect(sentBody(fetchMock)).toEqual({ email: 'a@b.vn', otp: '1234', newPassword: 'matkhau-moi' });
});
