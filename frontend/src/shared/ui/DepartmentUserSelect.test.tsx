import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DepartmentUserSelect } from './DepartmentUserSelect';

const departments = [
  { id: 1, departmentName: 'Phòng Kỹ thuật' },
  { id: 2, departmentName: 'Phòng Kế toán' },
];
const users = [
  { id: 7, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
  { id: 8, fullName: 'Trần Thị B', username: 'b', departmentId: 2 },
  { id: 9, fullName: 'Lê Văn C', username: 'c', departmentId: 1 },
  { id: 1, fullName: 'Quản trị', username: 'admin', departmentId: null },
];

const options = (name: string) =>
  Array.from((screen.getByLabelText(name) as HTMLSelectElement).options).map((o) => o.text);

it('chưa chọn phòng: ô người bị khoá', () => {
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={() => {}} />);
  expect(screen.getByLabelText('Người nhận')).toBeDisabled();
});

it('chọn phòng: chỉ hiện người của phòng đó, không bao giờ có người không phòng ban', () => {
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={() => {}} />);
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  expect(options('Người nhận')).toEqual(['— Chọn người —', 'Nguyễn Văn A (a)', 'Lê Văn C (c)']);
});

it('chọn người gọi onChange(id); đổi phòng gọi onChange(null)', () => {
  const onChange = vi.fn();
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Người nhận'), { target: { value: '9' } });
  expect(onChange).toHaveBeenLastCalledWith(9);
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '2' } });
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it('excludeUserId bị loại khỏi danh sách', () => {
  render(
    <DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={() => {}} excludeUserId={7} />,
  );
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  expect(options('Người nhận')).toEqual(['— Chọn người —', 'Lê Văn C (c)']);
});

it('có value sẵn: phòng ban tự suy ra từ người đó', () => {
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={8} onChange={() => {}} />);
  expect(screen.getByLabelText('Phòng ban (Người nhận)')).toHaveValue('2');
  expect(screen.getByLabelText('Người nhận')).toHaveValue('8');
});
