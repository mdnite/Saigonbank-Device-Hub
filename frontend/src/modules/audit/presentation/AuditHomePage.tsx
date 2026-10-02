import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateAudit } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Tabs } from '@/shared/ui/Tabs';
import { AuditListTab } from './AuditListTab';
import { SummaryListTab } from './SummaryListTab';
import { ScheduleAuditModal } from './ScheduleAuditModal';

const TABS = [
  { id: 'detail', label: 'Kiểm kê chi tiết' },
  { id: 'quantity', label: 'Kiểm kê số lượng' },
  { id: 'summary', label: 'Tổng hợp kiểm kê chi tiết' },
];

export function AuditHomePage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const [scheduling, setScheduling] = useState(false);
  // Tab nằm trên URL để "Quay lại" từ trang chi tiết về đúng tab.
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'detail';

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Kiểm kê' }]}
        title="Kiểm kê"
        actions={
          canCreateAudit(session) && (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setScheduling(true)}>
              Lập lịch kiểm kê
            </Button>
          )
        }
      />
      <Card className="p-5">
        <Tabs items={TABS} active={tab} onChange={(id) => setParams({ tab: id })} className="mb-5" />
        {tab === 'detail' && <AuditListTab />}
        {tab === 'quantity' && (
          <p className="py-16 text-center text-sm text-ink-muted">
            Kiểm kê số lượng đang được phát triển — sẽ có trong đợt triển khai tiếp theo.
          </p>
        )}
        {tab === 'summary' && <SummaryListTab />}
      </Card>
      <ScheduleAuditModal
        open={scheduling}
        onClose={() => setScheduling(false)}
        onCreated={(a) => navigate(`/audit/${a.id}`)}
      />
    </>
  );
}
