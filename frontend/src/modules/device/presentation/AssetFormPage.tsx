import { useNavigate } from 'react-router-dom';
import { Paperclip, Plus } from 'lucide-react';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Checkbox, Input, Radio, Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { DeviceValidationError } from '../application/DeviceRepository';
import { deviceService } from '../infrastructure/container';
import { AssetGeneralInfoFields } from './form/AssetGeneralInfoFields';
import { ComponentsTable } from './form/ComponentsTable';
import { useAssetDraft } from './form/useAssetDraft';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-base font-semibold text-ink">{children}</h3>;
}

export function AssetFormPage() {
  const navigate = useNavigate();
  const { draft, errors, patch, validate } = useAssetDraft();

  const submit = useAsyncAction(async () => {
    if (!validate()) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
    try {
      await deviceService.create(draft);
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
          { label: 'Tài sản', to: '/devices' },
          { label: 'Thêm tài sản' },
        ]}
        title="Thêm tài sản"
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
            <AssetGeneralInfoFields draft={draft} errors={errors} onChange={patch} />
          </section>

          <section className="p-6">
            <SectionTitle>Linh kiện</SectionTitle>
            <ComponentsTable
              components={draft.components}
              onChange={(components) => patch({ components })}
            />
          </section>

          <section className="p-6">
            <SectionTitle>Đã cấp phát</SectionTitle>
            <div className="space-y-5">
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
                <Field label="Vị trí công việc" className="min-w-[220px] flex-1">
                  <Input
                    disabled={!draft.allocated}
                    value={draft.jobLocation}
                    onChange={(e) => patch({ jobLocation: e.target.value })}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-ink">Đối tượng sử dụng</span>
                <Radio
                  id="target-emp"
                  name="targetType"
                  label="Nhân viên"
                  disabled={!draft.allocated}
                  checked={draft.targetType === 'EMPLOYEE'}
                  onChange={() => patch({ targetType: 'EMPLOYEE' })}
                />
                <Radio
                  id="target-dep"
                  name="targetType"
                  label="Phòng ban"
                  disabled={!draft.allocated}
                  checked={draft.targetType === 'DEPARTMENT'}
                  onChange={() => patch({ targetType: 'DEPARTMENT' })}
                />
              </div>

              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                <Field label="Nhân viên" required={draft.allocated} error={errors.employee}>
                  <Input
                    disabled={!draft.allocated}
                    value={draft.employee}
                    onChange={(e) => patch({ employee: e.target.value })}
                  />
                </Field>
                <Field label="Số biên bản" required={draft.allocated} error={errors.recordNo}>
                  <Input
                    disabled={!draft.allocated}
                    value={draft.recordNo}
                    onChange={(e) => patch({ recordNo: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="p-6">
            <SectionTitle>Bảo hành</SectionTitle>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
              <Field label="Thời gian bảo hành">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={draft.warrantyDuration}
                    onChange={(e) => patch({ warrantyDuration: e.target.value })}
                  />
                  <Select
                    className="w-28"
                    value={draft.warrantyUnit}
                    onChange={(e) =>
                      patch({ warrantyUnit: e.target.value as typeof draft.warrantyUnit })
                    }
                    options={[
                      { value: 'MONTH', label: 'Tháng' },
                      { value: 'YEAR', label: 'Năm' },
                    ]}
                  />
                </div>
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
