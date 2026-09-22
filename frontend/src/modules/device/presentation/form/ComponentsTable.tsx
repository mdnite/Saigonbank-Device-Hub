import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/inputs';
import type { DeviceAccessoryDraft } from '../../domain/deviceDraft';

const EMPTY: DeviceAccessoryDraft = { accessoryCode: '', accessoryName: '', accessoryType: '', unit: '' };
const HEADERS = ['Mã linh kiện', 'Tên linh kiện', 'Loại linh kiện', 'ĐVT'];
const KEYS = ['accessoryCode', 'accessoryName', 'accessoryType', 'unit'] as const;

export function ComponentsTable({
  components,
  onChange,
}: {
  components: DeviceAccessoryDraft[];
  onChange: (next: DeviceAccessoryDraft[]) => void;
}) {
  const patch = (i: number, key: keyof DeviceAccessoryDraft, value: string) =>
    onChange(components.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
            {HEADERS.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold">
                {h}
              </th>
            ))}
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {components.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                Chưa có linh kiện
              </td>
            </tr>
          ) : (
            components.map((c, i) => (
              <tr key={i} className="border-t border-line">
                {KEYS.map((key) => (
                  <td key={key} className="px-2 py-2">
                    <Input
                      value={c[key]}
                      onChange={(e) => patch(i, key, e.target.value)}
                      className="border-transparent bg-transparent focus:bg-white"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    aria-label="Xóa linh kiện"
                    onClick={() => onChange(components.filter((_, idx) => idx !== i))}
                    className="rounded p-1.5 text-ink-muted hover:bg-status-dangerBg hover:text-status-dangerFg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="border-t border-line p-3">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Plus className="h-4 w-4" />}
          onClick={() => onChange([...components, { ...EMPTY }])}
        >
          Thêm linh kiện
        </Button>
      </div>
    </div>
  );
}
