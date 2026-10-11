import { hasErrors, validateOrderDraft, type OrderDraft } from '../domain/validateOrderDraft';
import type { DeviceOrder, DeviceOrderDetail, UserRef, DepartmentRef } from '../domain/deviceOrder';

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
  /** Xoá mềm (chỉ TP Kỹ thuật, đơn Đã duyệt / Từ chối). */
  remove(id: number): Promise<DeviceOrderDetail>;
  /** Xoá cứng các đơn "Đã xóa" trong ids. */
  purge(ids: number[]): Promise<{ count: number }>;
  departments(): Promise<DepartmentRef[]>;
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
    remove: (id: number) => repo.remove(id),
    purge: (ids: number[]) => repo.purge(ids),
    departments: () => repo.departments(),
  };
}

export type DeviceOrderService = ReturnType<typeof makeDeviceOrderService>;
