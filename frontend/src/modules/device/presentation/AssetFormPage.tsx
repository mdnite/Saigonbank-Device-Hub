import { useNavigate, useParams } from 'react-router-dom';
import { Paperclip, Plus } from 'lucide-react';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Checkbox, Input } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { DeviceValidationError } from '../application/DeviceRepository';
import { deviceService } from '../infrastructure/container';
import type { DepartmentRef, Device, DeviceTypeRef, UserRef } from '../domain/device';
import { emptyDeviceDraft, type DeviceDraft } from '../domain/deviceDraft';
import { AssetGeneralInfoFields } from './form/AssetGeneralInfoFields';
import { ComponentsTable } from './form/ComponentsTable';
import { useDeviceDraft } from './form/useDeviceDraft';
import { useDeviceLookups } from './useDeviceLookups';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-base font-semibold text-ink">{children}</h3>;
}

/** Device (đọc từ API) → DeviceDraft (dạng form) để nạp sẵn trang sửa. */
function toDraft(d: Device): DeviceDraft {
  return {
    deviceCode: d.deviceCode,
    deviceName: d.deviceName,
    serialNumber: d.serialNumber ?? '',
    specDetail: d.specDetail,
    unit: d.unit,
    deviceTypeId: d.deviceType.id,
    location: d.location ?? '',
    purchaseDate: d.purchaseDate ?? '',
    supplier: d.supplier ?? '',
    warrantyMonths: d.warrantyMonths != null ? String(d.warrantyMonths) : '',
    warrantyCondition: d.warrantyCondition ?? '',
    warrantyExpiresOn: d.warrantyExpiresOn ?? '',
    departmentId: d.department?.id ?? null,
    currentUserId: d.currentUser?.id ?? null,
    allocated: d.allocatedOn != null,
    allocatedOn: d.allocatedOn ?? '',
    accessories: d.accessories.map(({ accessoryCode, accessoryName, accessoryType, unit }) => ({
      accessoryCode,
      accessoryName,
      accessoryType,
      unit,
    })),
  };
}

/** Đọc `id` trên route: không có → chế độ tạo, có → nạp thiết bị rồi mở form sửa. */
export function AssetFormPage() {
  const { id } = useParams<{ id: string }>();
  const deviceId = id ? Number(id) : null;
  const { deviceTypes, departments, users } = useDeviceLookups();
  const { data: existing, loading } = useAsyncData(
    () => (deviceId !== null ? deviceService.get(deviceId) : Promise.resolve(null)),
    [deviceId],
  );

  if (deviceId !== null && loading) {
    return <p className="p-6 text-ink-muted">Đang tải…</p>;
  }

  return (
    <DeviceForm
      key={deviceId ?? 'new'}
      deviceId={deviceId}
      initial={existing ? toDraft(existing) : { ...emptyDeviceDraft(), unit: 'Cái' }}
      deviceTypes={deviceTypes}
      departments={departments}
      users={users}
    />
  );
}

function DeviceForm({
  deviceId,
  initial,
  deviceTypes,
  departments,
  users,
}: {
  deviceId: number | null;
  initial: DeviceDraft;
  deviceTypes: DeviceTypeRef[];
  departments: DepartmentRef[];
  users: UserRef[];
}) {
  const navigate = useNavigate();
  const { draft, errors, patch, validate } = useDeviceDraft(initial);
  const isEdit = deviceId !== null;
  const title = isEdit ? 'Sửa thiết bị' : 'Thêm thiết bị';

  const submit = useAsyncAction(async () => {
    if (!validate()) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
    try {
      if (isEdit) await deviceService.update(deviceId, draft);
      else await deviceService.create(draft);
      navigate('/devices');
    } catch (e) {
      if (e instanceof DeviceValidationError) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
      throw e;
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Thiết bị', to: '/devices' },
          { label: title },
        ]}
        title={title}
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
            <SectionTitle>Thông tin chung</SectionTitle>
            <AssetGeneralInfoFields
              draft={draft}
              errors={errors}
              onChange={patch}
              deviceTypes={deviceTypes}
              departments={departments}
              users={users}
            />
          </section>

          <section className="p-6">
            <SectionTitle>Linh kiện</SectionTitle>
            <ComponentsTable
              components={draft.accessories}
              onChange={(accessories) => patch({ accessories })}
            />
          </section>

          <section className="p-6">
            <SectionTitle>Đã cấp phát</SectionTitle>
            <div className="flex flex-wrap items-end gap-4">
              <Checkbox
                id="allocated"
                label="Đã cấp phát ngày"
                checked={draft.allocated}
                onChange={(e) => patch({ allocated: e.target.checked })}
              />
              <Input
                type="date"
                className="w-48"
                disabled={!draft.allocated}
                value={draft.allocatedOn}
                onChange={(e) => patch({ allocatedOn: e.target.value })}
              />
            </div>
            {draft.allocated && (
              <p className="mt-2 text-xs text-ink-muted">Chọn "Người sở hữu" ở phần Thông tin chung.</p>
            )}
          </section>

          <section className="p-6">
            <SectionTitle>Bảo hành</SectionTitle>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
              <Field label="Thời gian bảo hành (tháng)">
                <Input
                  type="number"
                  min={0}
                  className="w-32"
                  value={draft.warrantyMonths}
                  onChange={(e) => patch({ warrantyMonths: e.target.value })}
                />
              </Field>
              <Field label="Điều kiện bảo hành" className="md:col-span-2">
                <Input
                  value={draft.warrantyCondition}
                  onChange={(e) => patch({ warrantyCondition: e.target.value })}
                />
              </Field>
              <Field label="Hạn bảo hành">
                <Input
                  type="date"
                  value={draft.warrantyExpiresOn}
                  onChange={(e) => patch({ warrantyExpiresOn: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="p-6">
            <SectionTitle>Tệp đính kèm</SectionTitle>
            <Button variant="link" leadingIcon={<Paperclip className="h-4 w-4" />} className="text-status-okFg">
              Thêm tài liệu
            </Button>
          </section>

          <section className="p-6">
            <SectionTitle>Thông tin khác</SectionTitle>
            <p className="mb-2 text-sm italic text-ink-muted">Chưa có thông tin tùy chỉnh</p>
            <Button variant="link" leadingIcon={<Plus className="h-4 w-4" />} className="text-status-okFg">
              Thêm thông tin tùy chỉnh
            </Button>
          </section>

          <div className="flex items-center justify-end gap-3 p-6">
            {submit.error && <span className="mr-auto text-sm text-status-dangerFg">{submit.error}</span>}
            <Button type="button" variant="outline" onClick={() => navigate('/devices')}>
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
