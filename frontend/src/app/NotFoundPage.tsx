import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-app px-6 text-center">
      <div>
        <p className="font-display text-5xl font-bold text-brand">404</p>
        <p className="mt-2 text-ink-muted">Không tìm thấy trang bạn yêu cầu.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          Về trang tổng quan
        </Link>
      </div>
    </div>
  );
}
