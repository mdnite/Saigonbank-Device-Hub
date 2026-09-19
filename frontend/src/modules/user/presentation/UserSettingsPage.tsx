import { useEffect, useState } from 'react';
import { Bell, IdCard, Lock, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { UserSettingsValidationError } from '../application/UserSettingsRepository';
import { userSettingsService } from '../infrastructure/container';
import { useUserSettings } from './useUserSettings';
import { GeneralInfoTab } from './tabs/GeneralInfoTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { SecurityTab } from './tabs/SecurityTab';

type TabId = 'general' | 'notifications' | 'security';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'Thông tin chung', icon: IdCard },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'security', label: 'Bảo mật & Quyền riêng tư', icon: Lock },
];

export function UserSettingsPage() {
  const { data: loaded } = useAsyncData(() => userSettingsService.get(), []);
  const { draft, errors, dirty, patch, load, revert, validate } = useUserSettings();
  const [tab, setTab] = useState<TabId>('general');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded) load(loaded);
  }, [loaded, load]);

  const change: typeof patch = (p) => {
    setSaved(false);
    patch(p);
  };

  const save = useAsyncAction(async () => {
    if (!validate()) {
      setTab('general');
      throw new Error('Vui lòng kiểm tra các trường bắt buộc');
    }
    try {
      const next = await userSettingsService.save(draft);
      load(next);
      setSaved(true);
    } catch (e) {
      if (e instanceof UserSettingsValidationError) {
        setTab('general');
        throw new Error('Vui lòng kiểm tra các trường bắt buộc');
      }
      throw e;
    }
  });

  const activeLabel = TABS.find((t) => t.id === tab)!.label;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Cài đặt' },
        ]}
        title={activeLabel}
        actions={
          <>
            {saved && <span className="mr-1 text-sm text-status-okFg">Đã lưu thay đổi</span>}
            {save.error && <span className="mr-1 text-sm text-status-dangerFg">{save.error}</span>}
            <Button
              variant="outline"
              onClick={revert}
              disabled={save.pending || !loaded || !dirty}
            >
              Hủy
            </Button>
            <Button
              variant="dark"
              onClick={() => void save.run()}
              disabled={save.pending || !loaded || !dirty}
            >
              {save.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </>
        }
      />

      <Card className="p-6">
        {!loaded ? (
          <div className="h-96 animate-pulse rounded-xl bg-surface-sunken" />
        ) : (
          <div className="flex flex-col gap-8 md:flex-row">
            <nav className="flex shrink-0 gap-1 md:w-60 md:flex-col" aria-label="Cài đặt tài khoản">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = id === tab;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                      active
                        ? 'bg-surface-sunken text-brand'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 flex-1">
              {tab === 'general' && <GeneralInfoTab draft={draft} errors={errors} onChange={change} />}
              {tab === 'notifications' && (
                <NotificationsTab draft={draft} errors={errors} onChange={change} />
              )}
              {tab === 'security' && <SecurityTab draft={draft} errors={errors} onChange={change} />}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
