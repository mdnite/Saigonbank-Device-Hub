import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ACTOR, Allow } from '../../shared/auth/actors';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import { SUMMARY_NOT_FOUND } from './audit-status';
import { CreateAuditSummaryDto } from './audits.dto';
import { AuditSummariesService } from './audit-summaries.service';

const SummaryId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(SUMMARY_NOT_FOUND),
    }),
  );

@Controller('audit-summaries')
@UseGuards(AuthGuard)
@Allow(ACTOR.ACCT_HEAD, ACTOR.ACCT_SPECIALIST)
export class AuditSummariesController {
  constructor(private readonly summaries: AuditSummariesService) {}

  @Get()
  list() {
    return this.summaries.list();
  }

  @Get(':id')
  get(@SummaryId() id: number) {
    return this.summaries.getById(id);
  }

  @Post()
  @Allow(ACTOR.ACCT_SPECIALIST)
  @ResponseMessage('Đã lập bảng tổng hợp')
  create(@Body() dto: CreateAuditSummaryDto, @Req() req: AuthedRequest) {
    return this.summaries.create(dto, req.user.id);
  }

  @Delete(':id')
  @Allow(ACTOR.ACCT_HEAD)
  @ResponseMessage('Đã xoá bảng tổng hợp')
  remove(@SummaryId() id: number) {
    return this.summaries.remove(id);
  }
}
