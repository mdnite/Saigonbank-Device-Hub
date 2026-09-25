import { hasErrors, validateTransferDraft, type TransferDraft } from '../domain/validateTransferDraft';
import type { DeviceTransfer, DeviceTransferDetail, UserRef } from '../domain/deviceTransfer';

export interface DeviceTransferQuery {
  status?: string;
}

export interface DeviceTransferRepository {
  list(query?: DeviceTransferQuery): Promise<DeviceTransfer[]>;
  getById(id: number): Promise<DeviceTransferDetail>;
  create(draft: TransferDraft): Promise<DeviceTransferDetail>;
  approve(id: number): Promise<DeviceTransferDetail>;
  reject(id: number, reason: string): Promise<DeviceTransferDetail>;
  /** Danh sách rút gọn cho dropdown người giao/người nhận — cùng /users/lookup module device dùng. */
  users(): Promise<UserRef[]>;
}

export class TransferValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'TransferValidationError';
  }
}

function assertValid(draft: TransferDraft) {
  const errors = validateTransferDraft(draft);
  if (hasErrors(errors)) throw new TransferValidationError(errors as Record<string, string>);
}

export function makeDeviceTransferService(repo: DeviceTransferRepository) {
  return {
    list: (query?: DeviceTransferQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: TransferDraft) => {
      assertValid(draft);
      return repo.create(draft);
    },
    approve: (id: number) => repo.approve(id),
    reject: (id: number, reason: string) => repo.reject(id, reason),
    users: () => repo.users(),
  };
}

export type DeviceTransferService = ReturnType<typeof makeDeviceTransferService>;
