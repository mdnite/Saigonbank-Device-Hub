import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { AuditMemberPicker } from './AuditMemberPicker';

const departments = [
  { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
  { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
];
const users = [
  { id: 7, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
  { id: 8, fullName: 'Trần Thị B', username: 'b', departmentId: 2 },
];

function Harness({ initial = [] as number[], stale = [] as { id: number; fullName: string; username: string }[] }) {
  const [selected, setSelected] = useState(initial);
  return <AuditMemberPicker users={users} departments={departments} selected={selected} onChange={setSelected} stale={stale} />;
}

it('chưa chọn phòng: chỉ hiện gợi ý, không có checkbox', () => {
  render(<Harness />);
  expect(screen.getByText('Chọn phòng ban để xem nhân viên')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('lọc theo phòng, giữ lựa chọn khi đổi phòng, bỏ chọn qua chip', () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '1' } });
  fireEvent.click(screen.getByLabelText('Nguyễn Văn A (a)'));
  expect(screen.queryByLabelText('Trần Thị B (b)')).toBeNull();
  fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '2' } });
  fireEvent.click(screen.getByLabelText('Trần Thị B (b)'));
  expect(screen.getByText('Đã chọn (2)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ Nguyễn Văn A' }));
  expect(screen.getByText('Đã chọn (1)')).toBeInTheDocument();
});

it('thành viên ngừng hoạt động: chip có nhãn, bỏ chọn được', () => {
  render(<Harness initial={[99]} stale={[{ id: 99, fullName: 'Cũ', username: 'cu' }]} />);
  expect(screen.getByText(/Cũ — ngừng hoạt động/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ Cũ' }));
  expect(screen.getByText('Đã chọn (0)')).toBeInTheDocument();
});
