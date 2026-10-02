import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ACTOR, Allow } from '../../shared/auth/actors';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import { AUDIT_NOT_FOUND } from './audit-status';
import { CreateAuditDto, ListAuditsQuery } from './audits.dto';
import { AuditsService } from './audits.service';

export const AuditId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(AUDIT_NOT_FOUND),
    }),
  );

/** Kiểm kê: CHỈ TP Kế toán + CTV Kế toán (#3). Handler chặt hơn thì @Allow riêng (ghi đè class). */
@Controller('audits')
@UseGuards(AuthGuard)
@Allow(ACTOR.ACCT_HEAD, ACTOR.ACCT_COLLAB)
export class AuditsController {
  constructor(private readonly audits: AuditsService) {}

  @Get()
  list(@Query() query: ListAuditsQuery) {
    return this.audits.list(query);
  }

  // Khai báo TRƯỚC ':id' — không thì ParseIntPipe của ':id' nuốt "locations" thành 404.
  @Get('locations')
  locations() {
    return this.audits.locations();
  }

  @Get(':id')
  get(@AuditId() id: number) {
    return this.audits.getById(id);
  }

  @Post()
  @Allow(ACTOR.ACCT_COLLAB)
  @ResponseMessage('Đã lập lịch kiểm kê')
  create(@Body() dto: CreateAuditDto, @Req() req: AuthedRequest) {
    return this.audits.create(dto, req.user.id);
  }
}
