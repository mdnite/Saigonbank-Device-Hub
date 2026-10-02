import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { AuditHomePage } from './AuditHomePage';

let failPost = false;
afterEach(() => {
  failPost = false;
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const audit = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  status: 'Đang kiểm kê',
  departmentId: 1,
  unitName: 'Phòng Kỹ thuật',
  dueDate: '2020-01-31T00:00:00.000Z',
  purpose: 'Định kỳ',
  deviceTypeName: null,
  location: null,
  rejectReason: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  startedAt: null,
  submittedAt: null,
  decidedAt: null,
  createdBy: { id: 5, fullName: 'CTV Kế toán' },
  decidedBy: null,
  deviceCount: 2,
  totalLines: 3,
  countedLines: 1,
  ...over,
});

const envelope = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }));

function renderPage(roleName: string, url = '/audit') {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName,
      departmentCode: 'KETOAN',
    }),
  );
  const fetchMock = vi.fn().mockImplementation((u: string, init?: RequestInit) => {
    if (failPost && init?.method === 'POST')
      return Promise.resolve(new Response(JSON.stringify({ success: false, data: null, error: 'X', message: 'Lỗi máy chủ' }), { status: 400 }));
    if (u.endsWith('/audits') && init?.method === 'POST') return envelope({ ...audit(9), items: [], members: [] });
    if (u.includes('/audits/locations')) return envelope(['Tầng 3']);
    if (u.includes('/audit-summaries')) return envelope([{ id: 4, title: 'Quý 3', purpose: null, createdAt: '2026-10-01T00:00:00.000Z', createdBy: { id: 5, fullName: 'CTV' }, auditCount: 2 }]);
    if (u.includes('/audits')) return envelope([audit(1)]);
    if (u.includes('/departments')) return envelope([{ id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' }]);
    if (u.includes('/device-types')) return envelope([{ id: 1, typeName: 'Laptop', prefix: 'LT' }]);
    if (u.includes('/users/lookup')) return envelope([{ id: 7, fullName: 'Nguyễn Văn A', username: 'a' }]);
    return envelope([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[url]}>
        <AuditHomePage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('CTV Kế toán: thấy "Lập lịch kiểm kê"; danh sách có tiến độ và nhãn Quá hạn', async () => {
  renderPage('Cộng tác viên');
  await waitFor(() => expect(screen.getByText('Phòng Kỹ thuật')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Lập lịch kiểm kê' })).toBeInTheDocument();
  expect(screen.getByText('1/3')).toBeInTheDocument();
  expect(screen.getByText('Quá hạn')).toBeInTheDocument();
  expect(screen.getByText('31/01/2020')).toBeInTheDocument();
});

it('TP Kế toán: không có nút lập lịch', async () => {
  renderPage('Trưởng phòng');
  await waitFor(() => expect(screen.getByText('Phòng Kỹ thuật')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Lập lịch kiểm kê' })).toBeNull();
});

it('tab Tổng hợp qua ?tab=summary: danh sách bảng + nút lập bảng (CTV)', async () => {
  renderPage('Cộng tác viên', '/audit?tab=summary');
  await waitFor(() => expect(screen.getByText('Quý 3')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Lập bảng tổng hợp' })).toBeInTheDocument();
});

it('Lập lịch: bỏ trống → báo lỗi; điền đủ (Kho) → POST đúng body', async () => {
  const fetchMock = renderPage('Cộng tác viên');
  fireEvent.click(await screen.findByRole('button', { name: 'Lập lịch kiểm kê' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Lập lịch' }));
  expect(await screen.findByText('Vui lòng chọn đơn vị kiểm kê')).toBeInTheDocument();

  await screen.findByRole('option', { name: 'Phòng Kỹ thuật' });
  fireEvent.change(screen.getByLabelText(/Đơn vị kiểm kê/), { target: { value: 'KHO' } });
  fireEvent.change(screen.getByLabelText(/Đến ngày/), { target: { value: '2026-10-31' } });
  fireEvent.change(screen.getByLabelText(/Mục đích/), { target: { value: 'Định kỳ' } });
  fireEvent.click(screen.getByLabelText('Nguyễn Văn A (a)'));
  fireEvent.click(screen.getByRole('button', { name: 'Lập lịch' }));

  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(true),
  );
  const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')!;
  expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
    departmentId: null,
    dueDate: '2026-10-31',
    purpose: 'Định kỳ',
    memberIds: [7],
  });
});

it('Lập lịch: lỗi gửi hiện ra, đóng rồi mở lại thì mất', async () => {
  failPost = true;
  renderPage('Cộng tác viên');
  fireEvent.click(await screen.findByRole('button', { name: 'Lập lịch kiểm kê' }));
  await screen.findByRole('option', { name: 'Phòng Kỹ thuật' });
  fireEvent.change(screen.getByLabelText(/Đơn vị kiểm kê/), { target: { value: 'KHO' } });
  fireEvent.change(screen.getByLabelText(/Đến ngày/), { target: { value: '2026-10-31' } });
  fireEvent.change(screen.getByLabelText(/Mục đích/), { target: { value: 'Định kỳ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lập lịch' }));
  expect(await screen.findByText('Lỗi máy chủ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lập lịch kiểm kê' }));
  await screen.findByRole('option', { name: 'Phòng Kỹ thuật' });
  expect(screen.queryByText('Lỗi máy chủ')).toBeNull();
});

it('Lập bảng tổng hợp: nhãn đợt có #id; lỗi gửi mất sau khi đóng và mở lại', async () => {
  failPost = true;
  renderPage('Cộng tác viên', '/audit?tab=summary');
  fireEvent.click(await screen.findByRole('button', { name: 'Lập bảng tổng hợp' }));
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Quý 4' } });
  fireEvent.click(await screen.findByLabelText('#1 · Phòng Kỹ thuật · Định kỳ · đến 31/01/2020'));
  fireEvent.click(screen.getByRole('button', { name: 'Lập bảng' }));
  expect(await screen.findByText('Lỗi máy chủ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lập bảng tổng hợp' }));
  await screen.findByLabelText('#1 · Phòng Kỹ thuật · Định kỳ · đến 31/01/2020');
  expect(screen.queryByText('Lỗi máy chủ')).toBeNull();
});
