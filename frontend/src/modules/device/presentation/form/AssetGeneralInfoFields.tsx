import { Field } from '@/shared/ui/Field';
import { Input, Select } from '@/shared/ui/inputs';
import type { DeviceDraft, DeviceDraftErrors } from '../../domain/deviceDraft';
import type { DepartmentRef, DeviceTypeRef, UserRef } from '../../domain/device';

export interface AssetFieldsProps {
  draft: DeviceDraft;
  errors: DeviceDraftErrors;
  onChange: (patch: Partial<DeviceDraft>) => void;
  deviceTypes: DeviceTypeRef[];
  departments: DepartmentRef[];
  users: UserRef[];
}

export function AssetGeneralInfoFields({
  draft,
  errors,
  onChange,
  deviceTypes,
  departments,
  users,
}: AssetFieldsProps) {
  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
      <Field label="Mã thiết bị" required error={errors.deviceCode}>
        <Input
          placeholder="VD: PC-000123"
          value={draft.deviceCode}
          onChange={(e) => onChange({ deviceCode: e.target.value })}
        />
      </Field>

      <Field label="Tên thiết bị" required error={errors.deviceName}>
        <Input
          placeholder="VD: Dell Latitude 5420"
          value={draft.deviceName}
          onChange={(e) => onChange({ deviceName: e.target.value })}
        />
      </Field>

      <Field label="Loại thiết bị" required error={errors.deviceTypeId}>
        <Select
          placeholder="Chọn loại thiết bị"
          value={draft.deviceTypeId !== null ? String(draft.deviceTypeId) : ''}
          onChange={(e) => onChange({ deviceTypeId: e.target.value ? Number(e.target.value) : null })}
          options={deviceTypes.map((t) => ({ value: String(t.id), label: `${t.typeName} (${t.prefix})` }))}
        />
      </Field>

      <Field label="Đơn vị tính" required error={errors.unit}>
        <Input value={draft.unit} onChange={(e) => onChange({ unit: e.target.value })} />
      </Field>

      <Field label="Số serial">
        <Input value={draft.serialNumber} onChange={(e) => onChange({ serialNumber: e.target.value })} />
      </Field>

      <Field label="Cấu hình chi tiết" required error={errors.specDetail}>
        <Input
          placeholder="VD: Intel Core i7 / 16GB / 512GB"
          value={draft.specDetail}
          onChange={(e) => onChange({ specDetail: e.target.value })}
        />
      </Field>

      <Field label="Đơn vị quản lý">
        <Select
          value={draft.departmentId !== null ? String(draft.departmentId) : ''}
          onChange={(e) => onChange({ departmentId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Chưa gán phòng ban</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Người sở hữu" required={draft.allocated} error={errors.currentUserId}>
        <Select
          value={draft.currentUserId !== null ? String(draft.currentUserId) : ''}
          onChange={(e) => onChange({ currentUserId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Chưa gán người sở hữu</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.username})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nhà cung cấp">
        <Input value={draft.supplier} onChange={(e) => onChange({ supplier: e.target.value })} />
      </Field>

      <Field label="Ngày mua">
        <Input
          type="date"
          value={draft.purchaseDate}
          onChange={(e) => onChange({ purchaseDate: e.target.value })}
        />
      </Field>

      <Field label="Vị trí thiết bị">
        <Input
          placeholder="VD: Tầng 3 - Phòng 302"
          value={draft.location}
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </Field>
    </div>
  );
}
