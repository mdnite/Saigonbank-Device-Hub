import { Construction } from 'lucide-react';
import { PageHeader } from './PageHeader';

/** Placeholder for nav destinations not built in this pass (Người dùng, Điều chuyển, Kiểm kê, Cài đặt). */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-white py-24 text-center">
        <Construction className="mb-3 h-8 w-8 text-ink-faint" />
        <p className="font-medium text-ink">Màn hình "{title}" đang được phát triển</p>
        <p className="mt-1 text-sm text-ink-muted">Sẽ có trong đợt triển khai tiếp theo.</p>
      </div>
    </>
  );
}
