import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MAX_INT32 } from '../users/users.dto';
import { buildMatrix } from './audit-matrix';
import { AUDIT_STATUS, SUMMARY_NOT_FOUND } from './audit-status';
import type { CreateAuditSummaryDto } from './audits.dto';

const SUMMARY_INCLUDE = {
  createdBy: true,
  audits: { include: { audit: { include: { items: true } } } },
} as const;

type SummaryWithRelations = Prisma.AuditSummaryGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;

function toListItem(s: SummaryWithRelations) {
  return {
    id: s.id,
    title: s.title,
    purpose: s.purpose,
    createdAt: s.createdAt,
    createdBy: { id: s.createdBy.id, fullName: s.createdBy.fullName },
    auditCount: s.audits.length,
  };
}

function toDetail(s: SummaryWithRelations) {
  const audits = s.audits.map((l) => l.audit).sort((a, b) => a.id - b.id);
  return {
    ...toListItem(s),
    audits: audits.map((a) => ({
      id: a.id,
      unitName: a.unitName,
      purpose: a.purpose,
      dueDate: a.dueDate,
      decidedAt: a.decidedAt,
      deviceCount: a.items.length,
    })),
    matrix: buildMatrix(audits),
  };
}

@Injectable()
export class AuditSummariesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const summaries = await this.prisma.auditSummary.findMany({
      include: SUMMARY_INCLUDE,
      orderBy: { id: 'desc' },
    });
    return summaries.map(toListItem);
  }

  async getById(id: number) {
    if (Math.abs(id) > MAX_INT32)
      throw new NotFoundException(SUMMARY_NOT_FOUND);
    const summary = await this.prisma.auditSummary.findUnique({
      where: { id },
      include: SUMMARY_INCLUDE,
    });
    if (!summary) throw new NotFoundException(SUMMARY_NOT_FOUND);
    return toDetail(summary);
  }

  async create(dto: CreateAuditSummaryDto, createdById: number) {
    const audits = await this.prisma.audit.findMany({
      where: { id: { in: dto.auditIds } },
      select: { id: true, status: true },
    });
    const invalid = dto.auditIds.filter(
      (id) => audits.find((a) => a.id === id)?.status !== AUDIT_STATUS.APPROVED,
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Chỉ tổng hợp được đợt kiểm kê đã duyệt (không hợp lệ: #${invalid.join(', #')})`,
      );
    }
    const summary = await this.prisma.auditSummary.create({
      data: {
        title: dto.title,
        purpose: dto.purpose ?? null,
        createdById,
        audits: { create: dto.auditIds.map((auditId) => ({ auditId })) },
      },
      include: SUMMARY_INCLUDE,
    });
    return toDetail(summary);
  }
}
