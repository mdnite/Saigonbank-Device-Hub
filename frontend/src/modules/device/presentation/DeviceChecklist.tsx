import { useState } from 'react';
import { Checkbox, Select } from '@/shared/ui/inputs';
import { SearchInput } from '@/shared/ui/SearchInput';
import type { Device, DeviceTypeRef } from '../domain/device';
import { deviceLocations, EMPTY_DEVICE_FILTER, filterDevices } from '../domain/filterDevices';

/** Danh sách tick thiết bị có ô tìm + lọc loại + lọc vị trí. Lọc không bỏ tick máy bị ẩn. */
export function DeviceChecklist({
  devices,
  deviceTypes,
  selectedIds,
  onToggle,
}: {
  devices: Device[];
  deviceTypes: DeviceTypeRef[];
  selectedIds: number[];
  onToggle: (id: number, checked: boolean) => void;
}) {
  const [filter, setFilter] = useState(EMPTY_DEVICE_FILTER);
  const shown = filterDevices(devices, filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          aria-label="Tìm thiết bị"
          placeholder="Tìm theo mã, tên hoặc serial"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          aria-label="Lọc loại thiết bị"
          className="sm:w-48"
          value={filter.typeId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, typeId: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">Loại (Tất cả)</option>
          {deviceTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.typeName}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Lọc vị trí"
          className="sm:w-48"
          value={filter.location}
          onChange={(e) => setFilter((f) => ({ ...f, location: e.target.value }))}
        >
          <option value="">Vị trí (Tất cả)</option>
          {deviceLocations(devices).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-ink-muted">Đã chọn {selectedIds.length} thiết bị</p>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-muted">Không có thiết bị khớp bộ lọc</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {shown.map((d) => (
            <div key={d.id}>
              <Checkbox
                id={`device-${d.id}`}
                label={`${d.deviceCode} — ${d.deviceName}`}
                checked={selectedIds.includes(d.id)}
                onChange={(e) => onToggle(d.id, e.target.checked)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
