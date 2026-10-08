import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { UserRef } from '@/modules/device/domain/device';
import { AuditMemberPicker } from './AuditMemberPicker';
import { auditService } from '../infrastructure/container';

export function AuditMembersTab({
  members,
  editable,
  onSave,
}: {
  members: UserRef[];
  editable: boolean;
  onSave: (userIds: number[]) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const { data: lookups } = useAsyncData(
    () => (editing ? Promise.all([auditService.users(), auditService.departments()]) : Promise.resolve(null)),
    [editing],
  );
  const [users, departments] = lookups ?? [null, []];

  const [saving, setSaving] = useState(false);
  // Thành viên hiện tại không còn trong danh sách đang hoạt động vẫn hiện (đã tick) để Chuyên viên bỏ chọn được.
  const lookupIds = new Set((users ?? []).map((u) => u.id));
  const stale = users ? members.filter((m) => !lookupIds.has(m.id)) : [];

  const startEdit = () => {
    setSelected(members.map((m) => m.id));
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <AuditMemberPicker
          users={users ?? []}
          departments={departments}
          selected={selected}
          onChange={setSelected}
          stale={stale}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(false)}>
            Hủy
          </Button>
          <Button
            variant="dark"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void onSave(selected)
                .then((ok) => ok && setEditing(false))
                .finally(() => setSaving(false));
            }}
          >
            Lưu thành viên
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {editable && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={startEdit}>
            Sửa thành viên
          </Button>
        </div>
      )}
      <DataTable
        columns={[
          { key: 'name', header: 'Họ tên', cell: (m: UserRef) => m.fullName },
          { key: 'username', header: 'Tên đăng nhập', cell: (m: UserRef) => m.username },
        ]}
        rows={members}
        rowKey={(m) => String(m.id)}
        empty="Chưa có thành viên tham gia"
      />
    </>
  );
}
