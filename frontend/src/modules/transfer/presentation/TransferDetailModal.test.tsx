import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TransferDetailModal } from './TransferDetailModal';

afterEach(() => {
  vi.unstubAllGlobals();
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: 12,
  status: 'Từ chối',
  note: null,
  rejectReason: 'Không đủ ngân sách',
  decidedAt: '2026-10-02T03:00:00.000Z',
  createdAt: '2026-10-01T03:00:00.000Z',
  fromUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
  toUser: { id: 6, fullName: 'Trần Thị B', username: 'b', departmentId: 2 },
  createdBy: { id: 2, fullName: 'Chuyên viên KT' },
  decidedBy: { id: 3, fullName: 'Trưởng phòng KT' },
  deviceCount: 1,
  items: [
    {
      id: 1,
      device: {
        id: 7,
        deviceCode: 'LT-000007',
        deviceName: 'Dell Latitude',
        serialNumber: 'SN7',
        deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
      },
    },
  ],
  ...over,
});

const stub = (data: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
    ),
  );

it('hiện người tạo, người duyệt, thiết bị và lý do từ chối', async () => {
  stub(detail());
  render(<TransferDetailModal id={12} onClose={() => {}} />);
  expect(await screen.findByText('LT-000007')).toBeInTheDocument();
  expect(screen.getByText('Chuyên viên KT')).toBeInTheDocument();
  expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
  expect(screen.getByText('Trưởng phòng KT')).toBeInTheDocument();
  expect(screen.getByText('Lý do từ chối')).toBeInTheDocument();
  expect(screen.getByText('Không đủ ngân sách')).toBeInTheDocument();
});

it('đơn đã xoá nhưng có lý do từ chối: vẫn hiện lý do', async () => {
  stub(detail({ status: 'Đã xóa' }));
  render(<TransferDetailModal id={12} onClose={() => {}} />);
  expect(await screen.findByText('Không đủ ngân sách')).toBeInTheDocument();
});

it('không có lý do từ chối: không có khung lý do, người duyệt "Chưa duyệt"', async () => {
  stub(detail({ status: 'Chờ duyệt', rejectReason: null, decidedBy: null, decidedAt: null }));
  render(<TransferDetailModal id={12} onClose={() => {}} />);
  expect(await screen.findByText('LT-000007')).toBeInTheDocument();
  expect(screen.queryByText('Lý do từ chối')).toBeNull();
  expect(screen.getByText('Chưa duyệt')).toBeInTheDocument();
});
