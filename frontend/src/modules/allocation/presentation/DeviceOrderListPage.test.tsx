import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { DeviceOrderListPage } from './DeviceOrderListPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const order = (id: number, status = 'Chờ duyệt') => ({
  id,
  type: 'Cấp phát',
  status,
  note: null,
  rejectReason: null,
  decidedAt: null,
  createdAt: '2026-09-24T00:00:00.000Z',
  targetUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a' },
  createdBy: { id: 2, fullName: 'Trưởng phòng Kỹ thuật' },
  decidedBy: null,
  deviceCount: 1,
});

const envelope = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
  );

function renderPage(roleName: string, departmentCode: string | null, orders = [order(1)]) {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName,
      departmentCode,
    }),
  );
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => envelope(orders)));
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceOrderListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Trưởng phòng Kỹ thuật: thấy nút "Tạo đơn", không thấy Duyệt/Từ chối', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo đơn' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Admin: thấy Duyệt/Từ chối trên đơn Chờ duyệt, không thấy "Tạo đơn"', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo đơn' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
});

it('Admin: đơn "Đã duyệt" hiện nút "In biên bản", không hiện Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null, [order(1, 'Đã duyệt')]);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'In biên bản' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});
