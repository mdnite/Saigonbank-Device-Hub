import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  let purged = false;
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/device-transfers/purge')) {
      purged = true;
      return envelope({ count: 1 });
    }
    if (init?.method === 'DELETE') return envelope({ ...transfer(1, 'Đã xóa') });
    if (url.includes('status=')) return envelope(purged ? [] : [transfer(9, 'Đã xóa')]);
    if (/\/device-transfers\/\d+$/.test(url)) return envelope({ ...transfer(1), items: [] });
    return envelope(transfers);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceTransferListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('Chuyên viên Kỹ thuật: thấy nút "Tạo lệnh", không thấy Duyệt/Từ chối', async () => {
  renderPage('Chuyên viên', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo lệnh' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Quản trị viên chỉ xem: không "Tạo lệnh", không Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo lệnh' })).toBeNull();
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

it('TP Kỹ thuật: lệnh Từ chối có nút Xoá → DELETE /device-transfers/:id; lệnh Chờ duyệt không có', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', 'KYTHUAT', [transfer(1, 'Từ chối'), transfer(2, 'Chờ duyệt')]);
  await waitFor(() => expect(screen.getAllByText('Nhân viên A')).toHaveLength(2));
  const deleteButtons = screen.getAllByRole('button', { name: 'Xoá' });
  expect(deleteButtons).toHaveLength(1);
  fireEvent.click(deleteButtons[0]);
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        (c) => (c[0] as string).endsWith('/device-transfers/1') && (c[1] as RequestInit)?.method === 'DELETE',
      ),
    ).toBe(true),
  );
});

it('Chuyên viên Kỹ thuật: không có nút Xoá; lọc "Đã xóa" xem được nhưng không có "Dọn thùng rác"', async () => {
  renderPage('Chuyên viên', 'KYTHUAT', [transfer(1, 'Từ chối')]);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'Đã xóa' } });
  // "Đã xóa" có cả trong <option> lẫn Badge của dòng → chờ tới khi có hơn 1 chỗ.
  await waitFor(() => expect(screen.getAllByText('Đã xóa').length).toBeGreaterThan(1));
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('TP Kỹ thuật lọc "Đã xóa": Dọn thùng rác gửi ids đang hiện, báo số đã xoá', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'Đã xóa' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Dọn thùng rác' }));
  await waitFor(() => expect(screen.getByText('Đã xoá 1 lệnh')).toBeInTheDocument());
  const call = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/device-transfers/purge'))!;
  expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ ids: [9] });
});

it('Dọn thùng rác không hiện khi danh sách "Đã xóa" chưa tải xong (còn dòng của bộ lọc cũ)', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  let resolve!: () => void;
  const gate = new Promise<void>((r) => (resolve = r));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => {
      await gate;
      return envelope([transfer(9, 'Đã xóa')]);
    }),
  );
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'Đã xóa' } });
  // dòng cũ vẫn hiện trong lúc chờ → không được cho dọn bằng id cũ
  expect(screen.getByText('Nhân viên A')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
  resolve();
  expect(await screen.findByRole('button', { name: 'Dọn thùng rác' })).toBeInTheDocument();
});

it('Quản trị viên: mọi dòng có nút "Chi tiết", bấm thì mở modal', async () => {
  renderPage('Quản trị viên', null, [transfer(1, 'Chờ duyệt'), transfer(2, 'Từ chối')]);
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Chi tiết' })).toHaveLength(2));
  fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
  expect(await screen.findByText('Chi tiết lệnh điều chuyển #1')).toBeInTheDocument();
});
