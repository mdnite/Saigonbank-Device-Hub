import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { UserQuery } from '../application/UserAdminRepository';
import { USER_STATUS, type UserAccount, type UserStatus } from '../domain/userAccount';
import { userAdminService } from '../infrastructure/container';
import { useUserLookups } from './useUserLookups';

const STATUS_TONE: Record<UserStatus, BadgeTone> = {
  'Đang hoạt động': 'ok',
  'Ngừng hoạt động': 'warn',
  'Đã xóa': 'neutral',
};

type RowAction = 'lock' | 'unlock' | 'delete';
const CONFIRM: Record<RowAction, string> = {
  lock: 'Khoá tài khoản',
  unlock: 'Mở khoá tài khoản',
  delete: 'Xoá tài khoản',
};

const ICON_BTN = 'rounded p-1 hover:bg-surface-sunken disabled:opacity-40';

export function UserListPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { roles, departments } = useUserLookups();
  const [query, setQuery] = useState<UserQuery>({ search: '', status: '', roleId: '', departmentId: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const { data: users, loading, error } = useAsyncData(
    () => userAdminService.list(query),
    [query.search, query.status, query.roleId, query.departmentId, reloadKey],
  );

  const act = useAsyncAction(async (user: UserAccount, action: RowAction) => {
    // ponytail: confirm native của trình duyệt — đổi sang Modal khi shared/ui có.
    if (!window.confirm(`${CONFIRM[action]} "${user.username}"?`)) return;
    if (action === 'delete') await userAdminService.remove(user.id);
    else
      await userAdminService.setStatus(
        user.id,
        action === 'lock' ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE,
      );
    setReloadKey((k) => k + 1);
  });

  const set = (patch: Partial<UserQuery>) => setQuery((q) => ({ ...q, ...patch }));

  const columns: Array<Column<UserAccount>> = [
    { key: 'username', header: 'Tên đăng nhập', cell: (u) => <span className="font-medium">{u.username}</span> },
    { key: 'fullName', header: 'Họ và tên', cell: (u) => u.fullName },
    { key: 'email', header: 'Email', cell: (u) => <span className="text-ink-muted">{u.email}</span> },
    { key: 'role', header: 'Vai trò', cell: (u) => u.role.roleName },
    { key: 'department', header: 'Phòng ban', cell: (u) => u.department?.departmentName ?? '—' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
          {!u.isVerified && u.status !== USER_STATUS.DELETED && <Badge tone="info">Chưa xác minh</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (u) => {
        // Không thao tác trên chính mình (BE cũng chặn) và trên tài khoản đã xoá.
        if (String(u.id) === session?.userId || u.status === USER_STATUS.DELETED) return null;
        const locked = u.status === USER_STATUS.INACTIVE;
        return (
          <div className="flex justify-end gap-1 text-ink-muted">
            <button
              type="button"
              className={ICON_BTN}
              disabled={act.pending}
              aria-label={locked ? CONFIRM.unlock : CONFIRM.lock}
              title={locked ? CONFIRM.unlock : CONFIRM.lock}
              onClick={() => void act.run(u, locked ? 'unlock' : 'lock')}
            >
              {locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className={`${ICON_BTN} hover:text-status-dangerFg`}
              disabled={act.pending}
              aria-label={CONFIRM.delete}
              title={CONFIRM.delete}
              onClick={() => void act.run(u, 'delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Người dùng' }]}
        title="Quản lý người dùng"
        actions={
          <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/users/new')}>
            Thêm người dùng
          </Button>
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row">
          <SearchInput
            placeholder="Tìm theo tên đăng nhập, họ tên hoặc email"
            value={query.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          <Select className="lg:w-48" value={query.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Trạng thái (Tất cả)</option>
            {Object.values(USER_STATUS).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select className="lg:w-44" value={query.roleId} onChange={(e) => set({ roleId: e.target.value })}>
            <option value="">Vai trò (Tất cả)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roleName}
              </option>
            ))}
          </Select>
          <Select
            className="lg:w-48"
            value={query.departmentId}
            onChange={(e) => set({ departmentId: e.target.value })}
          >
            <option value="">Phòng ban (Tất cả)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.departmentName}
              </option>
            ))}
          </Select>
        </div>

        {(act.error ?? error) && <p className="mb-3 text-sm text-status-dangerFg">{act.error ?? error}</p>}

        <DataTable
          columns={columns}
          rows={users ?? []}
          rowKey={(u) => String(u.id)}
          empty={loading ? 'Đang tải…' : 'Không tìm thấy người dùng nào'}
        />
      </Card>
    </>
  );
}
