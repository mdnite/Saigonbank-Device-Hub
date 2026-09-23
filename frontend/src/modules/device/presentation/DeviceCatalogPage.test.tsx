import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { DeviceCatalogPage } from './DeviceCatalogPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const device = (id: number, deviceCode: string) => ({
  id,
  deviceCode,
  deviceName: 'X',
  specDetail: 'X',
  unit: 'Cái',
  status: 'Trong kho',
  currentUser: null,
  deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
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
    if (url.endsWith('/devices/purge')) {
      purged = true;
      return envelope({ count: 1 });
    }
    if (url.includes('status=')) return envelope(purged ? [] : [device(9, 'PC-000009')]);
    return envelope([device(1, 'LT-000001')]);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceCatalogPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('Dọn thùng rác (Admin, đang lọc "Đã xóa"): xoá vĩnh viễn toàn bộ thiết bị đang hiển thị', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Dọn thùng rác' }));

  await waitFor(() => expect(screen.getByText('Không tìm thấy thiết bị nào')).toBeInTheDocument());
  const purgeCall = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/devices/purge'))!;
  expect(JSON.parse((purgeCall[1] as RequestInit).body as string)).toEqual({ ids: [9] });
});

it('Không phải Quản trị viên: không thấy nút "Dọn thùng rác" dù đang lọc "Đã xóa"', async () => {
  renderPage('Nhân viên');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('Admin nhưng chưa lọc "Đã xóa": không thấy nút "Dọn thùng rác"', async () => {
  renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});
