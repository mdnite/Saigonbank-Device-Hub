import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Hộp thoại dùng `<dialog>` gốc: showModal() cho sẵn backdrop, Esc, khoá focus — không cần thư viện.
 * Nội dung chỉ render khi open để form bên trong reset mỗi lần mở.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const isOpen = dialog.hasAttribute('open');
    // jsdom (test) chưa có showModal()/close() — rơi về thuộc tính open.
    if (open && !isOpen) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && isOpen) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: để React quyết định đóng (giữ state open đồng bộ)
        onClose();
      }}
      className="w-full max-w-2xl rounded-2xl border border-line p-0 shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h3 id="modal-title" className="text-lg font-bold text-ink">
              {title}
            </h3>
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              className="rounded p-1 text-ink-muted hover:bg-surface-sunken"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
