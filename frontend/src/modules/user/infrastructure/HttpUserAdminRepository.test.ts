import { afterEach, expect, it, vi } from 'vitest';
import { HttpUserAdminRepository } from './HttpUserAdminRepository';

const repo = new HttpUserAdminRepository();

function stubFetch(data: unknown, status = 200) {
  // mockImplementation (không phải mockResolvedValue): mỗi lần gọi cần Response mới —
  // body là stream, dùng lại 1 instance cho 2 lệnh gọi sẽ lỗi "body already read".
  const fetchMock = vi.fn().mockImplementation(
    async () => new Response(JSON.stringify({ success: status < 400, data, error: null, message: 'OK' }), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

it('list gửi bộ lọc khác rỗng lên query string', async () => {
  const fetchMock = stubFetch([]);
  await repo.list({ search: ' an ', status: '', roleId: '2', departmentId: '' });
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users?search=an&roleId=2');
});

it('create chuẩn hoá body: trim, email thường, id số, bỏ phòng ban trống và confirmPassword', async () => {
  const fetchMock = stubFetch({ id: 9 }, 201);
  await repo.create({
    username: ' tp ',
    fullName: ' Trưởng phòng ',
    email: ' TP@SGB.vn ',
    password: 'Init@123',
    confirmPassword: 'Init@123',
    roleId: '2',
    departmentId: '',
  });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://localhost:3000/users');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({
    username: 'tp',
    fullName: 'Trưởng phòng',
    email: 'tp@sgb.vn',
    password: 'Init@123',
    roleId: 2,
  });
});

it('setStatus → PATCH /users/:id/status, remove → DELETE /users/:id', async () => {
  const fetchMock = stubFetch(null);
  await repo.setStatus(5, 'Ngừng hoạt động');
  await repo.remove(5);
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users/5/status');
  expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'Ngừng hoạt động' });
  expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/users/5');
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
});
