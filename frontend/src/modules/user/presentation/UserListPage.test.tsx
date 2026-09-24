import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { UserListPage } from './UserListPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const user = (id: number, username: string, status = 'Đang hoạt động') => ({
  id,
  username,
  fullName: `User ${username}`,
  email: `${username}@sgb.vn`,
  status,
  isVerified: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  role: { id: 3, roleName: 'Nhân viên' },
  department: null,
});

const envelope = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
  );

function renderPage(roleName: string) {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName,
      departmentCode: null,
    }),
  );
  let purged = false;
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/users/purge')) {
      purged = true;
      return envelope({ count: 1 });
    }
    if (url.includes('/roles')) return envelope([]);
    if (url.includes('/departments')) return envelope([]);
    if (url.includes('status=')) return envelope(purged ? [] : [user(9, 'removed', 'Đã xóa')]);
    return envelope([user(1, 'active')]);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <UserListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('Dọn thùng rác (Admin, đang lọc "Đã xóa"): xoá vĩnh viễn toàn bộ người dùng đang hiển thị', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument());

  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('removed')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Dọn thùng rác' }));

  await waitFor(() => expect(screen.getByText('Không tìm thấy người dùng nào')).toBeInTheDocument());
  const purgeCall = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/users/purge'))!;
  expect(JSON.parse((purgeCall[1] as RequestInit).body as string)).toEqual({ ids: [9] });
});

it('Không phải Quản trị viên: không thấy nút "Dọn thùng rác" dù đang lọc "Đã xóa"', async () => {
  renderPage('Nhân viên');
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('removed')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('Admin nhưng chưa lọc "Đã xóa": không thấy nút "Dọn thùng rác"', async () => {
  renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});
