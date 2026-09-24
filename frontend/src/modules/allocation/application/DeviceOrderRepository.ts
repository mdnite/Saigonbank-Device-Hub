import { hasErrors, validateOrderDraft, type OrderDraft } from '../domain/validateOrderDraft';
import type { DeviceOrder, DeviceOrderDetail, UserRef } from '../domain/deviceOrder';

export interface DeviceOrderQuery {
  type?: string;
  status?: string;
}

export interface DeviceOrderRepository {
  list(query?: DeviceOrderQuery): Promise<DeviceOrder[]>;
  getById(id: number): Promise<DeviceOrderDetail>;
  create(draft: OrderDraft): Promise<DeviceOrderDetail>;
  approve(id: number): Promise<DeviceOrderDetail>;
  reject(id: number, reason: string): Promise<DeviceOrderDetail>;
  /** Danh sách rút gọn cho dropdown "Người liên quan" — cùng /users/lookup module device dùng. */
  users(): Promise<UserRef[]>;
}

export class OrderValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'OrderValidationError';
  }
}

function assertValid(draft: OrderDraft) {
  const errors = validateOrderDraft(draft);
  if (hasErrors(errors)) throw new OrderValidationError(errors as Record<string, string>);
}

export function makeDeviceOrderService(repo: DeviceOrderRepository) {
  return {
    list: (query?: DeviceOrderQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: OrderDraft) => {
      assertValid(draft);
      return repo.create(draft);
    },
    approve: (id: number) => repo.approve(id),
    reject: (id: number, reason: string) => repo.reject(id, reason),
    users: () => repo.users(),
  };
}

export type DeviceOrderService = ReturnType<typeof makeDeviceOrderService>;
