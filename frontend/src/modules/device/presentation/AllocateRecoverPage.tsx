import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { deviceService } from '../infrastructure/container';
import { AssetGeneralInfoFields } from './form/AssetGeneralInfoFields';
import { ComponentsTable } from './form/ComponentsTable';
import { useAssetDraft } from './form/useAssetDraft';

/** Group 16 — the "Cấp phát - Thu hồi" screen: general info + components, then save. */
export function AllocateRecoverPage() {
  const navigate = useNavigate();
  const { draft, errors, patch, validate } = useAssetDraft();

  const submit = useAsyncAction(async () => {
    if (!validate()) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
    await deviceService.create(draft);
    navigate('/devices');
  });

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Cấp phát - Thu hồi' }]}
        title="Cấp phát - Thu hồi"
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
            <h3 className="mb-4 text-base font-semibold text-ink">Thông tin chung</h3>
            <AssetGeneralInfoFields draft={draft} errors={errors} onChange={patch} />
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Linh kiện</h3>
            <ComponentsTable
              components={draft.components}
              onChange={(components) => patch({ components })}
            />
          </section>

          <div className="flex items-center justify-end gap-3 p-6">
            {submit.error && (
              <span className="mr-auto text-sm text-status-dangerFg">{submit.error}</span>
            )}
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
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
