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
import { ACTOR, Allow } from '../../shared/auth/actors';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import {
  CreateDeviceOrderDto,
  ListDeviceOrdersQuery,
  RejectDeviceOrderDto,
} from './device-orders.dto';
import { DeviceOrdersService, ORDER_NOT_FOUND } from './device-orders.service';

const OrderId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(ORDER_NOT_FOUND),
    }),
  );

@Controller('device-orders')
@UseGuards(AuthGuard)
@Allow(ACTOR.ADMIN, ACTOR.TECH_HEAD, ACTOR.TECH_SPECIALIST)
export class DeviceOrdersController {
  constructor(private readonly orders: DeviceOrdersService) {}

  @Get()
  list(@Query() query: ListDeviceOrdersQuery) {
    return this.orders.list(query);
  }

  @Get(':id')
  get(@OrderId() id: number) {
    return this.orders.getById(id);
  }

  @Post()
  @Allow(ACTOR.TECH_SPECIALIST)
  @ResponseMessage('Đã tạo đơn')
  create(@Body() dto: CreateDeviceOrderDto, @Req() req: AuthedRequest) {
    return this.orders.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã duyệt đơn')
  approve(@OrderId() id: number, @Req() req: AuthedRequest) {
    return this.orders.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã từ chối đơn')
  reject(
    @OrderId() id: number,
    @Body() dto: RejectDeviceOrderDto,
    @Req() req: AuthedRequest,
  ) {
    return this.orders.reject(id, req.user.id, dto.reason);
  }
}
