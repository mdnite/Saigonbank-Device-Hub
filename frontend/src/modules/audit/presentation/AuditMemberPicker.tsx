import { useState } from 'react';
import { X } from 'lucide-react';
import { Checkbox, Select } from '@/shared/ui/inputs';
import type { UserRef } from '@/modules/device/domain/device';
import { membersOfDepartment, type DepartmentRef, type MemberOption } from '../domain/audit';

/** Thành viên tham gia: lọc theo phòng ban rồi tick; lựa chọn giữ nguyên khi đổi phòng. */
export function AuditMemberPicker({
  users,
  departments,
  selected,
  onChange,
  stale = [],
}: {
  users: MemberOption[];
  departments: DepartmentRef[];
  selected: number[];
  onChange: (ids: number[]) => void;
  stale?: UserRef[];
}) {
  const [departmentId, setDepartmentId] = useState('');
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.departmentName ?? '';
  const chips = selected.flatMap((id) => {
    const u = users.find((x) => x.id === id);
    if (u) return [{ id, label: `${u.fullName} – ${deptName(u.departmentId)}`, name: u.fullName }];
    const s = stale.find((x) => x.id === id);
    return s ? [{ id, label: `${s.fullName} — ngừng hoạt động`, name: s.fullName }] : [];
  });
  const listed = departmentId ? membersOfDepartment(users, Number(departmentId)) : [];

  return (
    <div className="space-y-3">
      <Select aria-label="Phòng ban" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
        <option value="">Chọn phòng ban</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.departmentName}
          </option>
        ))}
      </Select>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-3">
        {!departmentId ? (
          <p className="text-sm text-ink-muted">Chọn phòng ban để xem nhân viên</p>
        ) : listed.length === 0 ? (
          <p className="text-sm text-ink-muted">Phòng ban chưa có nhân viên đang hoạt động</p>
        ) : (
          listed.map((u) => (
            <div key={u.id}>
              <Checkbox
                id={`audit-member-${u.id}`}
                label={`${u.fullName} (${u.username})`}
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
              />
            </div>
          ))
        )}
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-muted">Đã chọn ({chips.length})</p>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-sm text-ink">
              {c.label}
              <button
                type="button"
                aria-label={`Bỏ ${c.name}`}
                className="rounded-full p-0.5 hover:bg-line"
                onClick={() => toggle(c.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
