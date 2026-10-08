import { apiGet, apiPatch, apiPost, apiPut } from '@/shared/lib/apiClient';
import type { DeviceTypeRef } from '@/modules/device/domain/device';
import {
  WAREHOUSE_UNIT,
  type Audit,
  type AuditDetail,
  type AuditSummary,
  type AuditSummaryDetail,
  type DepartmentRef,
  type MemberOption,
} from '../domain/audit';
import type { AuditDraft, SummaryDraft } from '../domain/validateAuditDraft';
import type { AuditQuery, AuditRepository, LinePatch } from '../application/AuditRepository';

/** Draft modal → body POST /audits. Ô tuỳ chọn rỗng thì không gửi. */
export function toAuditBody(d: AuditDraft) {
  return {
    departmentId: d.unit === WAREHOUSE_UNIT ? null : Number(d.unit),
    dueDate: d.dueDate,
    purpose: d.purpose,
    deviceTypeId: d.deviceTypeId ? Number(d.deviceTypeId) : undefined,
    location: d.location || undefined,
    memberIds: d.memberIds,
  };
}

/** Adapter gọi module `audits` của backend (backend/src/modules/audits). */
export class HttpAuditRepository implements AuditRepository {
  list(query: AuditQuery = {}): Promise<Audit[]> {
    return apiGet<Audit[]>('/audits', query as Record<string, string | undefined>);
  }
  getById(id: number): Promise<AuditDetail> {
    return apiGet<AuditDetail>(`/audits/${id}`);
  }
  create(draft: AuditDraft): Promise<AuditDetail> {
    return apiPost<AuditDetail>('/audits', toAuditBody(draft));
  }
  start(id: number): Promise<AuditDetail> {
    return apiPost<AuditDetail>(`/audits/${id}/start`, undefined);
  }
  cancel(id: number): Promise<AuditDetail> {
    return apiPost<AuditDetail>(`/audits/${id}/cancel`, undefined);
  }
  setMembers(id: number, userIds: number[]): Promise<AuditDetail> {
    return apiPut<AuditDetail>(`/audits/${id}/members`, { userIds });
  }
  updateItem(id: number, itemId: number, patch: LinePatch): Promise<AuditDetail> {
    return apiPatch<AuditDetail>(`/audits/${id}/items/${itemId}`, patch);
  }
  updateAccessory(id: number, accessoryId: number, patch: LinePatch): Promise<AuditDetail> {
    return apiPatch<AuditDetail>(`/audits/${id}/accessories/${accessoryId}`, patch);
  }
  markUncountedOk(id: number): Promise<AuditDetail> {
    return apiPost<AuditDetail>(`/audits/${id}/mark-uncounted-ok`, undefined);
  }
  submit(id: number): Promise<AuditDetail> {
    return apiPost<AuditDetail>(`/audits/${id}/submit`, undefined);
  }
  approve(id: number): Promise<AuditDetail> {
    return apiPost<AuditDetail>(`/audits/${id}/approve`, undefined);
  }
  reject(id: number, reason: string): Promise<AuditDetail> {
    return apiPost<AuditDetail>(`/audits/${id}/reject`, { reason });
  }
  locations(): Promise<string[]> {
    return apiGet<string[]>('/audits/locations');
  }
  departments(): Promise<DepartmentRef[]> {
    return apiGet<DepartmentRef[]>('/departments');
  }
  deviceTypes(): Promise<DeviceTypeRef[]> {
    return apiGet<DeviceTypeRef[]>('/device-types');
  }
  users(): Promise<MemberOption[]> {
    return apiGet<MemberOption[]>('/users/lookup', { active: 'true' });
  }
  summaries(): Promise<AuditSummary[]> {
    return apiGet<AuditSummary[]>('/audit-summaries');
  }
  summary(id: number): Promise<AuditSummaryDetail> {
    return apiGet<AuditSummaryDetail>(`/audit-summaries/${id}`);
  }
  createSummary(draft: SummaryDraft): Promise<AuditSummaryDetail> {
    return apiPost<AuditSummaryDetail>('/audit-summaries', {
      title: draft.title.trim(),
      purpose: draft.purpose || undefined,
      auditIds: draft.auditIds,
    });
  }
}
