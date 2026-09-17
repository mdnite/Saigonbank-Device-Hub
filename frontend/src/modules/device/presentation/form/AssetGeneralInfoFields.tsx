import { Field } from '@/shared/ui/Field';
import { Input, Select } from '@/shared/ui/inputs';
import type { AssetDraft, AssetDraftErrors } from '../../domain/assetDraft';

export interface AssetFieldsProps {
  draft: AssetDraft;
  errors: AssetDraftErrors;
  onChange: (patch: Partial<AssetDraft>) => void;
}

const UNITS = ['Khối CNTT', 'Khối Vận hành', 'Chi nhánh Sài Gòn', 'Chi nhánh Hà Nội'];
const SUPPLIERS = ['Dell Việt Nam', 'FPT Trading', 'CMC', 'Khác'];
const SPECS = ['Intel Core i5 / 16GB / 512GB', 'Intel Core i7 / 16GB / 512GB', 'Intel Core i7 / 32GB / 1TB'];
const OWNERS = ['Nguyễn Văn A - IT', 'Trần Thị B - Kế toán', 'Lê Văn C - Vận hành'];

const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

export function AssetGeneralInfoFields({ draft, errors, onChange }: AssetFieldsProps) {
  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
      <Field label="Đơn vị quản lý" required error={errors.managingUnit}>
        <Select
          placeholder="Chọn đơn vị"
          options={toOptions(UNITS)}
          value={draft.managingUnit}
          onChange={(e) => onChange({ managingUnit: e.target.value })}
        />
      </Field>

      <Field label="Vị trí thiết bị" required error={errors.location}>
        <Input
          placeholder="VD: Tầng 3 - Phòng 302"
          value={draft.location}
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </Field>

      <Field label="Người sở hữu" required error={errors.owner}>
        <Select
          placeholder="Chọn người sở hữu"
          options={toOptions(OWNERS)}
          value={draft.owner}
          onChange={(e) => onChange({ owner: e.target.value })}
        />
      </Field>

      <Field label="Ngày mua">
        <Input
          type="date"
          value={draft.purchaseDate}
          onChange={(e) => onChange({ purchaseDate: e.target.value })}
        />
      </Field>

      <Field label="Mã thiết bị" required error={errors.deviceCode}>
        <Input
          placeholder="VD: LT-DELL-009"
          value={draft.deviceCode}
          onChange={(e) => onChange({ deviceCode: e.target.value })}
        />
      </Field>

      <Field label="Nhà cung cấp">
        <Select
          placeholder="Chọn nhà cung cấp"
          options={toOptions(SUPPLIERS)}
          value={draft.supplier}
          onChange={(e) => onChange({ supplier: e.target.value })}
        />
      </Field>

      <Field label="Tên thiết bị" required error={errors.deviceName}>
        <Input
          placeholder="VD: Dell Latitude 5420"
          value={draft.deviceName}
          onChange={(e) => onChange({ deviceName: e.target.value })}
        />
      </Field>

      <Field label="Cấu hình chi tiết" required error={errors.specDetail}>
        <Select
          placeholder="Chọn cấu hình"
          options={toOptions(SPECS)}
          value={draft.specDetail}
          onChange={(e) => onChange({ specDetail: e.target.value })}
        />
      </Field>
    </div>
  );
}
