import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { DeviceTransferListPage } from './DeviceTransferListPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const transfer = (id: number, status = 'Chờ duyệt') => ({
  id,
  status,
  note: null,
  rejectReason: null,
  decidedAt: null,
  createdAt: '2026-09-25T00:00:00.000Z',
  fromUser: { id: 5, fullName: 'Nhân viên A', username: 'a' },
  toUser: { id: 6, fullName: 'Nhân viên B', username: 'b' },
  createdBy: { id: 1, fullName: 'Quản trị viên' },
  decidedBy: null,
  deviceCount: 1,
});

const envelope = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
  );

function renderPage(roleName: string, departmentCode: string | null, transfers = [transfer(1)]) {
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
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => envelope(transfers)));
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceTransferListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Admin: thấy nút "Tạo lệnh", không thấy Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo lệnh' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Trưởng phòng Kỹ thuật: thấy Duyệt/Từ chối trên lệnh Chờ duyệt, không thấy "Tạo lệnh"', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo lệnh' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
});

it('Trưởng phòng Kỹ thuật: lệnh "Đã duyệt" hiện nút "In biên bản", không hiện Duyệt/Từ chối', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT', [transfer(1, 'Đã duyệt')]);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'In biên bản' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});
