import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { Roles } from '../../shared/auth/roles.decorator';
import { TransferAccessGuard } from '../../shared/auth/transfer-access.guard';
import { TransferDecideGuard } from '../../shared/auth/transfer-decide.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import { ROLE } from '../identity/roles';
import {
  CreateDeviceTransferDto,
  ListDeviceTransfersQuery,
  RejectDeviceTransferDto,
} from './device-transfers.dto';
import { DeviceTransfersService, TRANSFER_NOT_FOUND } from './device-transfers.service';

const TransferId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(TRANSFER_NOT_FOUND),
    }),
  );

@Controller('device-transfers')
@UseGuards(AuthGuard, TransferAccessGuard)
export class DeviceTransfersController {
  constructor(private readonly transfers: DeviceTransfersService) {}

  @Get()
  list(@Query() query: ListDeviceTransfersQuery) {
    return this.transfers.list(query);
  }

  @Get(':id')
  get(@TransferId() id: number) {
    return this.transfers.getById(id);
  }

  @Post()
  @Roles(ROLE.ADMIN)
  @ResponseMessage('Đã tạo lệnh điều chuyển')
  create(@Body() dto: CreateDeviceTransferDto, @Req() req: AuthedRequest) {
    return this.transfers.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @UseGuards(TransferDecideGuard)
  @ResponseMessage('Đã duyệt lệnh điều chuyển')
  approve(@TransferId() id: number, @Req() req: AuthedRequest) {
    return this.transfers.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @UseGuards(TransferDecideGuard)
  @ResponseMessage('Đã từ chối lệnh điều chuyển')
  reject(
    @TransferId() id: number,
    @Body() dto: RejectDeviceTransferDto,
    @Req() req: AuthedRequest,
  ) {
    return this.transfers.reject(id, req.user.id, dto.reason);
  }
}
