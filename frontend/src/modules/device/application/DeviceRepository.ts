import { hasErrors, validateDeviceDraft, type DeviceDraft } from '../domain/deviceDraft';
import type { DepartmentRef, Device, DeviceStatus, DeviceTypeRef, UserRef } from '../domain/device';

export interface DeviceQuery {
  search?: string;
  status?: DeviceStatus;
  deviceTypeId?: number;
  departmentId?: number;
  currentUserId?: number;
}

export interface DeviceRepository {
  list(query?: DeviceQuery): Promise<Device[]>;
  getById(id: number): Promise<Device>;
  create(draft: DeviceDraft): Promise<Device>;
  update(id: number, draft: DeviceDraft): Promise<Device>;
  remove(id: number): Promise<void>;
  /** Xoá cứng hàng loạt (dọn thùng rác) — chỉ xoá được thiết bị đã ở Status "Đã xóa". */
  purge(ids: number[]): Promise<number>;
  deviceTypes(): Promise<DeviceTypeRef[]>;
  departments(): Promise<DepartmentRef[]>;
  /** Danh sách rút gọn cho dropdown "Người sở hữu". */
  users(): Promise<UserRef[]>;
}

export class DeviceValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'DeviceValidationError';
  }
}

function assertValid(draft: DeviceDraft) {
  const errors = validateDeviceDraft(draft);
  if (hasErrors(errors)) throw new DeviceValidationError(errors as Record<string, string>);
}

export function makeDeviceService(repo: DeviceRepository) {
  return {
    list: (query?: DeviceQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: DeviceDraft) => {
      assertValid(draft);
      return repo.create(draft);
    },
    update: (id: number, draft: DeviceDraft) => {
      assertValid(draft);
      return repo.update(id, draft);
    },
    remove: (id: number) => repo.remove(id),
    purge: (ids: number[]) => repo.purge(ids),
    deviceTypes: () => repo.deviceTypes(),
    departments: () => repo.departments(),
    users: () => repo.users(),
  };
}

export type DeviceService = ReturnType<typeof makeDeviceService>;
