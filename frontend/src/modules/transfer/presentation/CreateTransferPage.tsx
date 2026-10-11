import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Textarea } from '@/shared/ui/inputs';
import { DepartmentUserSelect } from '@/shared/ui/DepartmentUserSelect';
import { DeviceChecklist } from '@/modules/device/presentation/DeviceChecklist';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { DEVICE_STATUS, type Device } from '@/modules/device/domain/device';
import { deviceService } from '@/modules/device/infrastructure/container';
import { emptyTransferDraft } from '../domain/validateTransferDraft';
import { TransferValidationError } from '../application/DeviceTransferRepository';
import { deviceTransferService } from '../infrastructure/container';

export function CreateTransferPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyTransferDraft());
  const { data: users } = useAsyncData(() => deviceTransferService.users(), []);
  const { data: departments } = useAsyncData(() => deviceTransferService.departments(), []);
  const { data: deviceTypes } = useAsyncData(() => deviceService.deviceTypes(), []);

  const { data: eligibleDevices, loading: loadingDevices } = useAsyncData<Device[]>(() => {
    if (draft.fromUserId === null) return Promise.resolve([]);
    return deviceService.list({ status: DEVICE_STATUS.ALLOCATED, currentUserId: draft.fromUserId });
  }, [draft.fromUserId]);

  const toggleDevice = (id: number, checked: boolean) => {
    setDraft((d) => ({
      ...d,
      deviceIds: checked ? [...d.deviceIds, id] : d.deviceIds.filter((x) => x !== id),
    }));
  };

  const submit = useAsyncAction(async () => {
    try {
      await deviceTransferService.create(draft);
      navigate('/transfers');
    } catch (e) {
      if (e instanceof TransferValidationError) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
      throw e;
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Điều chuyển', to: '/transfers' },
          { label: 'Tạo lệnh' },
        ]}
        title="Tạo lệnh điều chuyển"
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
            <h3 className="mb-4 text-base font-semibold text-ink">Người đang giữ</h3>
            <DepartmentUserSelect
              label="Người giao"
              departments={departments ?? []}
              users={users ?? []}
              value={draft.fromUserId}
              onChange={(fromUserId) => setDraft((d) => ({ ...d, fromUserId, deviceIds: [], toUserId: null }))}
            />
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Thiết bị</h3>
            {draft.fromUserId === null ? (
              <p className="text-sm text-ink-muted">Chọn người đang giữ trước.</p>
            ) : loadingDevices ? (
              <p className="text-sm text-ink-muted">Đang tải…</p>
            ) : (eligibleDevices ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">Người này không đang giữ thiết bị nào.</p>
            ) : (
              <DeviceChecklist
                devices={eligibleDevices ?? []}
                deviceTypes={deviceTypes ?? []}
                selectedIds={draft.deviceIds}
                onToggle={toggleDevice}
              />
            )}
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Người nhận</h3>
            <DepartmentUserSelect
              label="Người nhận"
              departments={departments ?? []}
              users={users ?? []}
              value={draft.toUserId}
              excludeUserId={draft.fromUserId}
              onChange={(toUserId) => setDraft((d) => ({ ...d, toUserId }))}
            />
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Ghi chú</h3>
            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </section>

          {submit.error && <p className="px-6 pb-2 text-sm text-status-dangerFg">{submit.error}</p>}

          <section className="flex justify-end gap-2 p-6">
            <Button type="button" variant="outline" onClick={() => navigate('/transfers')}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submit.pending}>
              Tạo lệnh
            </Button>
          </section>
        </form>
      </Card>
    </>
  );
}
