import { Fragment, useEffect, useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Input, Select } from '@/shared/ui/inputs';
import { SearchInput } from '@/shared/ui/SearchInput';
import {
  AUDIT_RESULT,
  AUDIT_RESULTS,
  groupByType,
  tally,
  type AuditDetail,
  type AuditItem,
  type AuditLine,
  type AuditResult,
} from '../domain/audit';
import type { LinePatch } from '../application/AuditRepository';

const RESULT_TONE = {
  [AUDIT_RESULT.OK]: 'ok',
  [AUDIT_RESULT.MISSING]: 'danger',
  [AUDIT_RESULT.BROKEN]: 'warn',
} as const;

/** Ô ghi chú: gõ thoải mái, chỉ lưu khi rời ô và nội dung đã đổi. */
function NoteInput({ value, label, onSave }: { value: string | null; label: string; onSave: (note: string) => void }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <Input
      aria-label={label}
      className="h-8 min-w-[10rem] text-xs"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== (value ?? '')) onSave(text);
      }}
    />
  );
}

function ResultCell({
  line,
  label,
  editable,
  onChange,
}: {
  line: AuditLine;
  label: string;
  editable: boolean;
  onChange: (patch: LinePatch) => void;
}) {
  if (!editable) {
    return line.result ? <Badge tone={RESULT_TONE[line.result]}>{line.result}</Badge> : <span className="text-ink-faint">—</span>;
  }
  return (
    <Select
      aria-label={label}
      className="h-8 w-28 text-xs"
      value={line.result ?? ''}
      onChange={(e) => e.target.value && onChange({ result: e.target.value as AuditResult })}
    >
      <option value="">—</option>
      {AUDIT_RESULTS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </Select>
  );
}

export function AuditItemsTable({
  detail,
  editable,
  onUpdateItem,
  onUpdateAccessory,
}: {
  detail: AuditDetail;
  editable: boolean;
  onUpdateItem: (itemId: number, patch: LinePatch) => void;
  onUpdateAccessory: (accessoryId: number, patch: LinePatch) => void;
}) {
  const [q, setQ] = useState('');
  const [grouped, setGrouped] = useState(false);
  const needle = q.trim().toLowerCase();
  const visible = detail.items.filter(
    (i) =>
      !needle ||
      [i.deviceCode, i.deviceName, i.serialNumber ?? ''].some((v) => v.toLowerCase().includes(needle)),
  );
  const groups = grouped ? groupByType(visible) : [{ typeName: '', items: visible }];
  const devices = tally(detail.items);
  const accessories = tally(detail.items.flatMap((i) => i.accessories));
  const hasAccessories = detail.items.some((i) => i.accessories.length > 0);

  const deviceRow = (i: AuditItem) => (
    <Fragment key={i.id}>
      <tr className="border-t border-line">
        <td className="px-3 py-2 font-medium">{i.deviceCode}</td>
        <td className="px-3 py-2">{i.deviceName}</td>
        <td className="px-3 py-2">{i.serialNumber ?? '—'}</td>
        <td className="px-3 py-2">{i.deviceTypeName}</td>
        <td className="px-3 py-2">{i.unit}</td>
        <td className="px-3 py-2">{i.departmentName ?? detail.unitName}</td>
        <td className="px-3 py-2">{i.holderName ?? '—'}</td>
        <td className="px-3 py-2">
          <ResultCell line={i} label={`Kết quả ${i.deviceCode}`} editable={editable} onChange={(p) => onUpdateItem(i.id, p)} />
        </td>
        <td className="px-3 py-2">
          {editable ? (
            <NoteInput value={i.note} label={`Ghi chú ${i.deviceCode}`} onSave={(note) => onUpdateItem(i.id, { note })} />
          ) : (
            i.note
          )}
        </td>
      </tr>
      {i.accessories.map((x) => (
        <tr key={`acc-${x.id}`} className="border-t border-line/60 bg-surface-app/40 text-ink-muted">
          <td className="px-3 py-2 pl-8 text-xs">{x.accessoryCode}</td>
          <td className="px-3 py-2 text-xs">↳ {x.accessoryName}</td>
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-xs">{x.accessoryType}</td>
          <td className="px-3 py-2 text-xs">{x.unit}</td>
          <td className="px-3 py-2" colSpan={2} />
          <td className="px-3 py-2">
            <ResultCell
              line={x}
              label={`Kết quả ${x.accessoryCode}`}
              editable={editable}
              onChange={(p) => onUpdateAccessory(x.id, p)}
            />
          </td>
          <td className="px-3 py-2">
            {editable ? (
              <NoteInput value={x.note} label={`Ghi chú ${x.accessoryCode}`} onSave={(note) => onUpdateAccessory(x.id, { note })} />
            ) : (
              x.note
            )}
          </td>
        </tr>
      ))}
    </Fragment>
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput placeholder="Tìm kiếm" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="sm:w-60" value={grouped ? 'type' : ''} onChange={(e) => setGrouped(e.target.value === 'type')}>
          <option value="">Không nhóm</option>
          <option value="type">Nhóm theo loại thiết bị</option>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Mã thiết bị</th>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Tên thiết bị</th>
              <th colSpan={5} className="px-3 py-2 text-center font-semibold">Thông tin chung</th>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Kết quả</th>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Ghi chú</th>
            </tr>
            <tr className="bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-3 py-2 text-left font-semibold">Số serial</th>
              <th className="px-3 py-2 text-left font-semibold">Loại thiết bị</th>
              <th className="px-3 py-2 text-left font-semibold">Đơn vị tính</th>
              <th className="px-3 py-2 text-left font-semibold">Đơn vị quản lý</th>
              <th className="px-3 py-2 text-left font-semibold">Người sở hữu</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink-muted">
                  Không tìm thấy thiết bị nào
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <Fragment key={g.typeName || 'all'}>
                {grouped && (
                  <tr className="border-t border-line bg-surface-sunken/60">
                    <td colSpan={9} className="px-3 py-2 font-semibold">
                      {g.typeName} ({g.items.length})
                    </td>
                  </tr>
                )}
                {g.items.map(deviceRow)}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-card-blue/40 font-semibold">
              <td className="px-3 py-2">Tổng cộng</td>
              <td colSpan={8} className="px-3 py-2">
                {detail.items.length} thiết bị · Đủ {devices.ok} · Thiếu {devices.missing} · Hỏng {devices.broken} · Chưa
                đếm {devices.uncounted}
                {hasAccessories &&
                  ` — Linh kiện: Đủ ${accessories.ok} · Thiếu ${accessories.missing} · Hỏng ${accessories.broken} · Chưa đếm ${accessories.uncounted}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
