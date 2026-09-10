import { Field } from '@/shared/ui/Field';
import { Input, Select, Textarea } from '@/shared/ui/inputs';
import { DEPARTMENTS, TITLES, type UserSettings, type UserSettingsErrors } from '../../domain/userSettings';

export interface TabProps {
  draft: UserSettings;
  errors: UserSettingsErrors;
  onChange: (patch: Partial<UserSettings>) => void;
}

const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

/** "Thông tin cơ bản" card — the one panel the Figma exports specify in full (Group 7). */
export function GeneralInfoTab({ draft, errors, onChange }: TabProps) {
  return (
    <div className="rounded-xl border border-line p-6">
      <h3 className="mb-5 text-base font-semibold text-ink">Thông tin cơ bản</h3>

      <div className="space-y-5">
        <Field label="Họ và tên" required error={errors.fullName}>
          <Input
            placeholder="VD: Nguyễn Văn A"
            value={draft.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
          />
        </Field>

        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <Field label="Phòng ban" required error={errors.department}>
            <Select
              placeholder="Chọn phòng ban"
              options={toOptions(DEPARTMENTS)}
              value={draft.department}
              onChange={(e) => onChange({ department: e.target.value })}
            />
          </Field>
          <Field label="Chức vụ" required error={errors.title}>
            <Select
              placeholder="Chọn chức vụ"
              options={toOptions(TITLES)}
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Email" required error={errors.email}>
          <Input
            type="email"
            placeholder="ten@saigonbank.com.vn"
            value={draft.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>

        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <Field label="Mã nhân viên" required error={errors.employeeCode}>
            <Input
              placeholder="VD: SGB-IT-0142"
              value={draft.employeeCode}
              onChange={(e) => onChange({ employeeCode: e.target.value })}
            />
          </Field>
          <Field label="Số điện thoại">
            <Input
              placeholder="Nhập SĐT"
              value={draft.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Ghi chú thêm">
          <Textarea
            rows={4}
            placeholder="Nhập thông tin ghi chú về nhân sự này (nếu có)…"
            value={draft.note}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
