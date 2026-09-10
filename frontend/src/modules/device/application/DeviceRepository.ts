import {
  hasErrors,
  validateAssetDraft,
  type AssetDraft,
} from '../domain/assetDraft';
import type { Device, DeviceStatus } from '../domain/device';

export interface DeviceQuery {
  search?: string;
  status?: DeviceStatus | 'ALL';
}

export interface DeviceRepository {
  list(query?: DeviceQuery): Promise<Device[]>;
  getById(id: string): Promise<Device | null>;
  create(draft: AssetDraft): Promise<Device>;
}

export class DeviceValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'DeviceValidationError';
  }
}

export function makeDeviceService(repo: DeviceRepository) {
  return {
    list: (query?: DeviceQuery) => repo.list(query),
    get: (id: string) => repo.getById(id),
    create: (draft: AssetDraft) => {
      const errors = validateAssetDraft(draft);
      if (hasErrors(errors)) throw new DeviceValidationError(errors as Record<string, string>);
      return repo.create(draft);
    },
  };
}

export type DeviceService = ReturnType<typeof makeDeviceService>;
