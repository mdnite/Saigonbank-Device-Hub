import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { AuditDetailPage } from './AuditDetailPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: 3,
  status: 'Đang kiểm kê',
  departmentId: 1,
  unitName: 'Phòng Kỹ thuật',
  dueDate: '2099-10-31T00:00:00.000Z',
  purpose: 'Định kỳ',
  deviceTypeName: null,
  location: null,
  rejectReason: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  startedAt: null,
  submittedAt: null,
  decidedAt: null,
  createdBy: { id: 5, fullName: 'CTV Kế toán' },
  decidedBy: null,
  deviceCount: 1,
  totalLines: 2,
  countedLines: 0,
  members: [{ id: 7, fullName: 'Nguyễn Văn A', username: 'a' }],
  items: [
    {
      id: 11,
      deviceId: 1,
      deviceCode: 'LT-000001',
      deviceName: 'Dell Latitude',
      serialNumber: 'SN1',
      deviceTypeName: 'Laptop',
      unit: 'Cái',
      holderName: 'Trần B',
      departmentName: 'Phòng Kỹ thuật',
      deviceStatus: 'Đã cấp phát',
      result: null,
      note: null,
      accessories: [
        { id: 21, accessoryCode: 'SAC-01', accessoryName: 'Sạc 65W', accessoryType: 'Nguồn', unit: 'Cái', result: null, note: null },
      ],
    },
  ],
  ...over,
});

const envelope = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }));

function renderPage(roleName: string, first: ReturnType<typeof detail>, after?: ReturnType<typeof detail>) {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName, departmentCode: 'KETOAN' }),
  );
  const fetchMock = vi
    .fn()
    .mockImplementation((_u: string, init?: RequestInit) =>
      envelope(after && init?.method && init.method !== 'GET' ? after : first),
    );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/audit/3']}>
        <Routes>
          <Route path="/audit/:id" element={<AuditDetailPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('tiêu đề theo Figma, có dòng linh kiện và dòng Tổng cộng', async () => {
  renderPage('Cộng tác viên', detail());
  expect(await screen.findByText(/Kiểm kê thiết bị tại Phòng Kỹ thuật đến ngày 31\/10\/2099/)).toBeInTheDocument();
  expect(screen.getByText('↳ Sạc 65W')).toBeInTheDocument();
  expect(screen.getByText(/1 thiết bị · Đủ 0 · Thiếu 0 · Hỏng 0 · Chưa đếm 1/)).toBeInTheDocument();
});

it('CTV + Đang kiểm kê: đổi kết quả gửi PATCH và cập nhật theo phản hồi; Gửi duyệt tắt khi chưa đủ', async () => {
  const counted = detail({
    countedLines: 1,
    items: [{ ...detail().items[0], result: 'Thiếu' }],
  });
  const fetchMock = renderPage('Cộng tác viên', detail(), counted);
  const select = await screen.findByLabelText('Kết quả LT-000001');
  expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeDisabled();

  fireEvent.change(select, { target: { value: 'Thiếu' } });
  await waitFor(() => expect(screen.getByLabelText('Kết quả LT-000001')).toHaveValue('Thiếu'));
  const patch = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')!;
  expect(patch[0]).toBe('http://localhost:3000/audits/3/items/11');
  expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ result: 'Thiếu' });
});

it('CTV + Chưa kiểm kê: có "Bắt đầu kiểm kê" và "Huỷ đợt", chưa nhập được', async () => {
  renderPage('Cộng tác viên', detail({ status: 'Chưa kiểm kê' }));
  expect(await screen.findByRole('button', { name: 'Bắt đầu kiểm kê' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Huỷ đợt' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Kết quả LT-000001')).toBeNull();
});

it('TP Kế toán + Chờ duyệt: Duyệt / Từ chối, không ô nhập', async () => {
  renderPage('Trưởng phòng', detail({ status: 'Chờ duyệt', countedLines: 2 }));
  expect(await screen.findByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Kết quả LT-000001')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).toBeNull();
});

it('bị từ chối: banner lý do', async () => {
  renderPage('Cộng tác viên', detail({ rejectReason: 'Đếm lại tầng 3' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bị từ chối: Đếm lại tầng 3');
});
