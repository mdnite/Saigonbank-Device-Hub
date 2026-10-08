import type { DeviceTypeRef } from '@/modules/device/domain/device';
import type {
  Audit,
  AuditDetail,
  AuditResult,
  AuditSummary,
  AuditSummaryDetail,
  DepartmentRef,
  MemberOption,
  PurgeResult,
} from '../domain/audit';
import {
  hasErrors,
  validateAuditDraft,
  validateSummaryDraft,
  type AuditDraft,
  type SummaryDraft,
} from '../domain/validateAuditDraft';

export interface AuditQuery {
  status?: string;
  q?: string;
}

/** Ghi chú '' = xoá ghi chú (backend lưu null). */
export interface LinePatch {
  result?: AuditResult;
  note?: string;
}

export interface AuditRepository {
  list(query?: AuditQuery): Promise<Audit[]>;
  getById(id: number): Promise<AuditDetail>;
  create(draft: AuditDraft): Promise<AuditDetail>;
  start(id: number): Promise<AuditDetail>;
  cancel(id: number): Promise<AuditDetail>;
  setMembers(id: number, userIds: number[]): Promise<AuditDetail>;
  updateItem(id: number, itemId: number, patch: LinePatch): Promise<AuditDetail>;
  updateAccessory(id: number, accessoryId: number, patch: LinePatch): Promise<AuditDetail>;
  markUncountedOk(id: number): Promise<AuditDetail>;
  submit(id: number): Promise<AuditDetail>;
  approve(id: number): Promise<AuditDetail>;
  reject(id: number, reason: string): Promise<AuditDetail>;
  locations(): Promise<string[]>;
  departments(): Promise<DepartmentRef[]>;
  deviceTypes(): Promise<DeviceTypeRef[]>;
  users(): Promise<MemberOption[]>;
  summaries(): Promise<AuditSummary[]>;
  summary(id: number): Promise<AuditSummaryDetail>;
  createSummary(draft: SummaryDraft): Promise<AuditSummaryDetail>;
  remove(id: number): Promise<AuditDetail>;
  purge(ids: number[]): Promise<PurgeResult>;
  removeSummary(id: number): Promise<void>;
}

export class AuditValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'AuditValidationError';
  }
}

function assertValid(errors: object) {
  if (hasErrors(errors)) throw new AuditValidationError(errors as Record<string, string>);
}

export function makeAuditService(repo: AuditRepository) {
  return {
    list: (query?: AuditQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: AuditDraft) => {
      assertValid(validateAuditDraft(draft));
      return repo.create(draft);
    },
    start: (id: number) => repo.start(id),
    cancel: (id: number) => repo.cancel(id),
    setMembers: (id: number, userIds: number[]) => repo.setMembers(id, userIds),
    updateItem: (id: number, itemId: number, patch: LinePatch) => repo.updateItem(id, itemId, patch),
    updateAccessory: (id: number, accessoryId: number, patch: LinePatch) =>
      repo.updateAccessory(id, accessoryId, patch),
    markUncountedOk: (id: number) => repo.markUncountedOk(id),
    submit: (id: number) => repo.submit(id),
    approve: (id: number) => repo.approve(id),
    reject: (id: number, reason: string) => repo.reject(id, reason),
    locations: () => repo.locations(),
    departments: () => repo.departments(),
    deviceTypes: () => repo.deviceTypes(),
    users: () => repo.users(),
    summaries: () => repo.summaries(),
    summary: (id: number) => repo.summary(id),
    remove: (id: number) => repo.remove(id),
    purge: (ids: number[]) => repo.purge(ids),
    removeSummary: (id: number) => repo.removeSummary(id),
    createSummary: (draft: SummaryDraft) => {
      assertValid(validateSummaryDraft(draft));
      return repo.createSummary(draft);
    },
  };
}

export type AuditService = ReturnType<typeof makeAuditService>;
