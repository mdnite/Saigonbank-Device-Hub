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

function renderPage(roleName: string, departmentCode: string | null = null) {
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

it('Dọn thùng rác (Trưởng phòng Kỹ thuật, đang lọc "Đã xóa"): xoá vĩnh viễn toàn bộ thiết bị đang hiển thị', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Dọn thùng rác' }));

  await waitFor(() => expect(screen.getByText('Không tìm thấy thiết bị nào')).toBeInTheDocument());
  const purgeCall = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/devices/purge'))!;
  expect(JSON.parse((purgeCall[1] as RequestInit).body as string)).toEqual({ ids: [9] });
});

it('Trưởng phòng Kỹ thuật chưa lọc "Đã xóa": không thấy "Dọn thùng rác", thấy Xoá và Xem', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Xoá thiết bị' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem chi tiết' })).toBeInTheDocument();
});

it('Cộng tác viên Kỹ thuật: thêm/sửa được, không thấy Xoá và "Dọn thùng rác"', async () => {
  renderPage('Cộng tác viên', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Thêm thiết bị' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem chi tiết' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Xoá thiết bị' })).toBeNull();

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('Quản trị viên chỉ xem: không Thêm, không Xoá, không Xem chi tiết, không "Dọn thùng rác"', async () => {
  renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Thêm thiết bị' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Xoá thiết bị' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).toBeNull();

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('Trưởng phòng Kỹ thuật: máy "Thất lạc" có nút "Tìm thấy" → POST /devices/:id/found rồi tải lại', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' }),
  );
  let found = false;
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/devices/3/found')) {
      found = true;
      return envelope({ ...device(3, 'LT-000003'), status: 'Đã cấp phát' });
    }
    return envelope([{ ...device(3, 'LT-000003'), status: found ? 'Đã cấp phát' : 'Thất lạc' }]);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceCatalogPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Tìm thấy' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Tìm thấy' })).toBeNull());
  expect(fetchMock.mock.calls.some((c) => (c[0] as string).endsWith('/devices/3/found'))).toBe(true);
});

it('Cộng tác viên Kỹ thuật: không thấy "Tìm thấy" trên máy Thất lạc', async () => {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName: 'Cộng tác viên', departmentCode: 'KYTHUAT' }),
  );
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => envelope([{ ...device(3, 'LT-000003'), status: 'Thất lạc' }])));
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceCatalogPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  await screen.findByText('LT-000003');
  expect(screen.queryByRole('button', { name: 'Tìm thấy' })).toBeNull();
});
