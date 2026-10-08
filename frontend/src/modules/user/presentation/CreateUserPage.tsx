import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Input, Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { UserAdminValidationError } from '../application/UserAdminRepository';
import {
  NO_DEPARTMENT,
  allowedRoleNames,
  emptyNewUserDraft,
  validateNewUser,
  type NewUserDraft,
  type NewUserErrors,
} from '../domain/userAccount';
import { userAdminService } from '../infrastructure/container';
import { useUserLookups } from './useUserLookups';

const INVALID = 'Vui lòng kiểm tra các trường bắt buộc';

export function CreateUserPage() {
  const navigate = useNavigate();
  const { roles, departments } = useUserLookups();
  const [draft, setDraft] = useState<NewUserDraft>(emptyNewUserDraft);
  const [errors, setErrors] = useState<NewUserErrors>({});
  const patch = (p: Partial<NewUserDraft>) => setDraft((d) => ({ ...d, ...p }));

  const codeOf = (departmentId: string): string | null | undefined =>
    departmentId === NO_DEPARTMENT
      ? null
      : departments.find((d) => String(d.id) === departmentId)?.departmentCode;
  const roleNameOf = (roleId: string) => roles.find((r) => String(r.id) === roleId)?.roleName;
  const deptCode = codeOf(draft.departmentId);
  const roleOptions =
    draft.departmentId && deptCode !== undefined
      ? roles.filter((r) => allowedRoleNames(deptCode).includes(r.roleName))
      : [];

  const submit = useAsyncAction(async () => {
    const next = validateNewUser(
      draft,
      roleNameOf(draft.roleId),
      draft.departmentId ? codeOf(draft.departmentId) : undefined,
    );
    setErrors(next);
    if (Object.keys(next).length) throw new Error(INVALID);
    try {
      await userAdminService.create(draft);
      navigate('/users');
    } catch (e) {
      if (e instanceof UserAdminValidationError) throw new Error(INVALID);
      throw e; // lỗi BE (vd. 409 trùng) hiện nguyên message tiếng Việt
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Người dùng', to: '/users' },
          { label: 'Thêm người dùng' },
        ]}
        title="Thêm người dùng"
      />

      <Card>
        <form
          className="divide-y divide-line"
          onSubmit={(e) => {
            e.preventDefault();
            void submit.run();
          }}
        >
          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Thông tin tài khoản</h3>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field label="Tên đăng nhập" htmlFor="username" required error={errors.username}>
                <Input
                  id="username"
                  autoComplete="off"
                  value={draft.username}
                  onChange={(e) => patch({ username: e.target.value })}
                />
              </Field>
              <Field label="Họ và tên" htmlFor="fullName" required error={errors.fullName}>
                <Input id="fullName" value={draft.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="email" required error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </Field>
              <Field label="Phòng ban" htmlFor="departmentId" required error={errors.departmentId}>
                <Select
                  id="departmentId"
                  value={draft.departmentId}
                  onChange={(e) => {
                    const departmentId = e.target.value;
                    const code = codeOf(departmentId);
                    const roleName = roleNameOf(draft.roleId);
                    // Đổi phòng làm chức vụ đang chọn không còn hợp lệ → xoá trắng chức vụ.
                    const keepRole = roleName && code !== undefined && allowedRoleNames(code).includes(roleName);
                    patch({ departmentId, roleId: keepRole ? draft.roleId : '' });
                  }}
                >
                  <option value="">Chọn phòng ban</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.departmentName}
                    </option>
                  ))}
                  <option value={NO_DEPARTMENT}>— Không (Quản trị viên) —</option>
                </Select>
              </Field>
              <Field label="Chức vụ" htmlFor="roleId" required error={errors.roleId}>
                <Select
                  id="roleId"
                  placeholder="Chọn chức vụ"
                  disabled={!draft.departmentId}
                  value={draft.roleId}
                  onChange={(e) => patch({ roleId: e.target.value })}
                  options={roleOptions.map((r) => ({ value: String(r.id), label: r.roleName }))}
                />
              </Field>
            </div>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Mật khẩu ban đầu</h3>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field
                label="Mật khẩu"
                htmlFor="password"
                required
                error={errors.password}
                hint="Tài khoản ở trạng thái “Chưa xác minh” cho tới khi nhân viên tự đặt lại mật khẩu qua “Quên mật khẩu”"
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={draft.password}
                  onChange={(e) => patch({ password: e.target.value })}
                />
              </Field>
              <Field label="Nhập lại mật khẩu" htmlFor="confirmPassword" required error={errors.confirmPassword}>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={draft.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 p-6">
            {submit.error && <span className="mr-auto text-sm text-status-dangerFg">{submit.error}</span>}
            <Button type="button" variant="outline" onClick={() => navigate('/users')}>
              Hủy
            </Button>
            <Button type="submit" variant="dark" disabled={submit.pending}>
              {submit.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
