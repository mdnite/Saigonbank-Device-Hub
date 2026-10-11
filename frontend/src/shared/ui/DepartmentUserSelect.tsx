import { useState } from 'react';
import { Select } from './inputs';

export interface DepartmentOption {
  id: number;
  departmentName: string;
}

export interface UserOption {
  id: number;
  fullName: string;
  username: string;
  departmentId: number | null;
}

/**
 * Chọn 1 người theo 2 bước: Phòng ban → Nhân viên. Người không có phòng ban (Quản trị viên) không
 * bao giờ hiện. Component thuần — dữ liệu nhận qua props, không tự gọi API.
 */
export function DepartmentUserSelect({
  label,
  departments,
  users,
  value,
  onChange,
  excludeUserId = null,
}: {
  label: string;
  departments: DepartmentOption[];
  users: UserOption[];
  value: number | null;
  onChange: (userId: number | null) => void;
  excludeUserId?: number | null;
}) {
  const [pickedDepartment, setPickedDepartment] = useState('');
  const selectedUser = users.find((u) => u.id === value);
  // Có value sẵn mà chưa chọn phòng (mở form với dữ liệu có sẵn) → suy ra phòng từ người đó.
  const departmentId =
    pickedDepartment || (selectedUser?.departmentId != null ? String(selectedUser.departmentId) : '');
  const listed = departmentId
    ? users.filter((u) => u.departmentId === Number(departmentId) && u.id !== excludeUserId)
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          aria-label={`Phòng ban (${label})`}
          value={departmentId}
          onChange={(e) => {
            setPickedDepartment(e.target.value);
            onChange(null);
          }}
        >
          <option value="">— Chọn phòng ban —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </Select>
        <Select
          aria-label={label}
          disabled={!departmentId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Chọn người —</option>
          {listed.map((u) => (
            <option key={u.id} value={u.id}>
              {`${u.fullName} (${u.username})`}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
