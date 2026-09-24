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
import { OrderAccessGuard } from '../../shared/auth/order-access.guard';
import { OrderCreateGuard } from '../../shared/auth/order-create.guard';
import { Roles } from '../../shared/auth/roles.decorator';
import { ResponseMessage } from '../../shared/http/api-response';
import { ROLE } from '../identity/roles';
import { CreateDeviceOrderDto, ListDeviceOrdersQuery, RejectDeviceOrderDto } from './device-orders.dto';
import { DeviceOrdersService, ORDER_NOT_FOUND } from './device-orders.service';

const OrderId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(ORDER_NOT_FOUND),
    }),
  );

@Controller('device-orders')
@UseGuards(AuthGuard, OrderAccessGuard)
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
  @UseGuards(OrderCreateGuard)
  @ResponseMessage('Đã tạo đơn')
  create(@Body() dto: CreateDeviceOrderDto, @Req() req: AuthedRequest) {
    return this.orders.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @Roles(ROLE.ADMIN)
  @ResponseMessage('Đã duyệt đơn')
  approve(@OrderId() id: number, @Req() req: AuthedRequest) {
    return this.orders.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles(ROLE.ADMIN)
  @ResponseMessage('Đã từ chối đơn')
  reject(@OrderId() id: number, @Body() dto: RejectDeviceOrderDto, @Req() req: AuthedRequest) {
    return this.orders.reject(id, req.user.id, dto.reason);
  }
}
