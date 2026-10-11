import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Device } from '../domain/device';
import { DeviceChecklist } from './DeviceChecklist';

const types = [
  { id: 1, typeName: 'Laptop', prefix: 'LT' },
  { id: 2, typeName: 'PC', prefix: 'PC' },
];
const devices = [
  { id: 1, deviceCode: 'LT-000001', deviceName: 'Dell', serialNumber: null, location: 'Tầng 2', deviceType: types[0] },
  { id: 2, deviceCode: 'PC-000002', deviceName: 'HP', serialNumber: null, location: 'Tầng 3', deviceType: types[1] },
] as Device[];

it('lọc ẩn máy đã tick nhưng vẫn đếm nó trong "Đã chọn"', () => {
  const onToggle = vi.fn();
  render(<DeviceChecklist devices={devices} deviceTypes={types} selectedIds={[1]} onToggle={onToggle} />);
  expect(screen.getByText('Đã chọn 1 thiết bị')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lọc loại thiết bị'), { target: { value: '2' } });
  expect(screen.queryByLabelText('LT-000001 — Dell')).toBeNull();
  expect(screen.getByText('Đã chọn 1 thiết bị')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('PC-000002 — HP'));
  expect(onToggle).toHaveBeenCalledWith(2, true);
});

it('lọc ra rỗng: báo không khớp', () => {
  render(<DeviceChecklist devices={devices} deviceTypes={types} selectedIds={[]} onToggle={() => {}} />);
  fireEvent.change(screen.getByLabelText('Tìm thiết bị'), { target: { value: 'zzz' } });
  expect(screen.getByText('Không có thiết bị khớp bộ lọc')).toBeInTheDocument();
});
