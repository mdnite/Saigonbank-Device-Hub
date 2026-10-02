import { makeAuditService } from '../application/AuditRepository';
import { HttpAuditRepository } from './HttpAuditRepository';

export const auditService = makeAuditService(new HttpAuditRepository());
