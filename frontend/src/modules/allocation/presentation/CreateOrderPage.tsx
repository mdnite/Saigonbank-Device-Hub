import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Checkbox, Radio, Select, Textarea } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { DEVICE_STATUS, type Device } from '@/modules/device/domain/device';
import { deviceService } from '@/modules/device/infrastructure/container';
import { ORDER_TYPE } from '../domain/deviceOrder';
import { emptyOrderDraft } from '../domain/validateOrderDraft';
import { OrderValidationError } from '../application/DeviceOrderRepository';
import { deviceOrderService } from '../infrastructure/container';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyOrderDraft());
  const { data: users } = useAsyncData(() => deviceOrderService.users(), []);

  const { data: eligibleDevices, loading: loadingDevices } = useAsyncData<Device[]>(() => {
    if (!draft.type || draft.targetUserId === null) return Promise.resolve([]);
    return draft.type === ORDER_TYPE.ALLOCATE
      ? deviceService.list({ status: DEVICE_STATUS.IN_STOCK })
      : deviceService.list({ status: DEVICE_STATUS.ALLOCATED, currentUserId: draft.targetUserId });
  }, [draft.type, draft.targetUserId]);

  const toggleDevice = (id: number, checked: boolean) => {
    setDraft((d) => ({
      ...d,
      deviceIds: checked ? [...d.deviceIds, id] : d.deviceIds.filter((x) => x !== id),
    }));
  };

  const submit = useAsyncAction(async () => {
    try {
      await deviceOrderService.create(draft);
      navigate('/allocation');
    } catch (e) {
      if (e instanceof OrderValidationError) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
      throw e;
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Cấp phát - Thu hồi', to: '/allocation' },
          { label: 'Tạo đơn' },
        ]}
        title="Tạo đơn"
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
            <h3 className="mb-4 text-base font-semibold text-ink">Loại đơn</h3>
            <div className="flex gap-6">
              <Radio
                id="type-allocate"
                name="type"
                label={ORDER_TYPE.ALLOCATE}
                checked={draft.type === ORDER_TYPE.ALLOCATE}
                onChange={() => setDraft((d) => ({ ...d, type: ORDER_TYPE.ALLOCATE, deviceIds: [] }))}
              />
              <Radio
                id="type-recover"
                name="type"
                label={ORDER_TYPE.RECOVER}
                checked={draft.type === ORDER_TYPE.RECOVER}
                onChange={() => setDraft((d) => ({ ...d, type: ORDER_TYPE.RECOVER, deviceIds: [] }))}
              />
            </div>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Người liên quan</h3>
            <Field label={draft.type === ORDER_TYPE.RECOVER ? 'Người đang giữ' : 'Người nhận'}>
              <Select
                value={draft.targetUserId ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    targetUserId: e.target.value ? Number(e.target.value) : null,
                    deviceIds: [],
                  }))
                }
              >
                <option value="">— Chọn người —</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Thiết bị</h3>
            {!draft.type || draft.targetUserId === null ? (
              <p className="text-sm text-ink-muted">Chọn loại đơn và người liên quan trước.</p>
            ) : loadingDevices ? (
              <p className="text-sm text-ink-muted">Đang tải…</p>
            ) : (eligibleDevices ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">Không có thiết bị phù hợp.</p>
            ) : (
              <div className="space-y-2">
                {(eligibleDevices ?? []).map((d) => (
                  <Checkbox
                    key={d.id}
                    id={`device-${d.id}`}
                    label={`${d.deviceCode} — ${d.deviceName}`}
                    checked={draft.deviceIds.includes(d.id)}
                    onChange={(e) => toggleDevice(d.id, e.target.checked)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Ghi chú</h3>
            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </section>

          {submit.error && <p className="px-6 pb-2 text-sm text-status-dangerFg">{submit.error}</p>}

          <section className="flex justify-end gap-2 p-6">
            <Button type="button" variant="outline" onClick={() => navigate('/allocation')}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submit.pending}>
              Tạo đơn
            </Button>
          </section>
        </form>
      </Card>
    </>
  );
}
