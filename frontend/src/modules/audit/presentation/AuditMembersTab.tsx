import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/inputs';
import { DataTable } from '@/shared/ui/DataTable';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { UserRef } from '@/modules/device/domain/device';
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
  const { data: users } = useAsyncData(
    () => (editing ? auditService.users() : Promise.resolve(null)),
    [editing],
  );

  const startEdit = () => {
    setSelected(members.map((m) => m.id));
    setEditing(true);
  };
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-line p-3">
          {(users ?? []).map((u) => (
            <div key={u.id}>
              <Checkbox
                id={`member-${u.id}`}
                label={`${u.fullName} (${u.username})`}
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(false)}>
            Hủy
          </Button>
          <Button
            variant="dark"
            onClick={() =>
              void onSave(selected).then((ok) => ok && setEditing(false))
            }
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
