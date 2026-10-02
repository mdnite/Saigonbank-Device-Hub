import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ACTOR, Allow } from '../../shared/auth/actors';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import { AUDIT_NOT_FOUND, LINE_NOT_FOUND } from './audit-status';
import {
  CreateAuditDto,
  ListAuditsQuery,
  RejectAuditDto,
  SetAuditMembersDto,
  UpdateAuditLineDto,
} from './audits.dto';
import { AuditsService } from './audits.service';

export const AuditId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(AUDIT_NOT_FOUND),
    }),
  );

const LineId = (name: string) =>
  Param(
    name,
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(LINE_NOT_FOUND),
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

  @Post(':id/start')
  @Allow(ACTOR.ACCT_COLLAB)
  @ResponseMessage('Đã bắt đầu kiểm kê')
  start(@AuditId() id: number) {
    return this.audits.start(id);
  }

  @Post(':id/cancel')
  @Allow(ACTOR.ACCT_COLLAB)
  @ResponseMessage('Đã huỷ đợt kiểm kê')
  cancel(@AuditId() id: number) {
    return this.audits.cancel(id);
  }

  @Put(':id/members')
  @Allow(ACTOR.ACCT_COLLAB)
  @ResponseMessage('Đã cập nhật thành viên tham gia')
  setMembers(@AuditId() id: number, @Body() dto: SetAuditMembersDto) {
    return this.audits.setMembers(id, dto.userIds);
  }

  @Patch(':id/items/:itemId')
  @Allow(ACTOR.ACCT_COLLAB)
  updateItem(
    @AuditId() id: number,
    @LineId('itemId') itemId: number,
    @Body() dto: UpdateAuditLineDto,
  ) {
    return this.audits.updateItem(id, itemId, dto);
  }

  @Patch(':id/accessories/:accessoryId')
  @Allow(ACTOR.ACCT_COLLAB)
  updateAccessory(
    @AuditId() id: number,
    @LineId('accessoryId') accessoryId: number,
    @Body() dto: UpdateAuditLineDto,
  ) {
    return this.audits.updateAccessory(id, accessoryId, dto);
  }

  @Post(':id/mark-uncounted-ok')
  @Allow(ACTOR.ACCT_COLLAB)
  @ResponseMessage('Đã ghi Đủ cho các dòng chưa đếm')
  markUncountedOk(@AuditId() id: number) {
    return this.audits.markUncountedOk(id);
  }

  @Post(':id/submit')
  @Allow(ACTOR.ACCT_COLLAB)
  @ResponseMessage('Đã gửi duyệt')
  submit(@AuditId() id: number) {
    return this.audits.submit(id);
  }

  @Post(':id/reject')
  @Allow(ACTOR.ACCT_HEAD)
  @ResponseMessage('Đã từ chối kết quả kiểm kê')
  reject(
    @AuditId() id: number,
    @Body() dto: RejectAuditDto,
    @Req() req: AuthedRequest,
  ) {
    return this.audits.reject(id, req.user.id, dto.reason);
  }
}
