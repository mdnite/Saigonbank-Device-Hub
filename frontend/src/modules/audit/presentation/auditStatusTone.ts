import type { BadgeTone } from '@/shared/ui/Badge';
import { AUDIT_STATUS, type AuditStatus } from '../domain/audit';

export const AUDIT_STATUS_TONE: Record<AuditStatus, BadgeTone> = {
  [AUDIT_STATUS.NOT_STARTED]: 'neutral',
  [AUDIT_STATUS.IN_PROGRESS]: 'info',
  [AUDIT_STATUS.PENDING]: 'warn',
  [AUDIT_STATUS.APPROVED]: 'ok',
  [AUDIT_STATUS.CANCELLED]: 'danger',
  [AUDIT_STATUS.DELETED]: 'neutral',
};
