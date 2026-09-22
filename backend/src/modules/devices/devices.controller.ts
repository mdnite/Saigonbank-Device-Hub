import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../shared/auth/auth.guard';
import { DeviceWriteGuard } from '../../shared/auth/device-write.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import {
  CreateDeviceDto,
  ListDevicesQuery,
  UpdateDeviceDto,
} from './devices.dto';
import { DEVICE_NOT_FOUND, DevicesService } from './devices.service';

const DeviceId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(DEVICE_NOT_FOUND),
    }),
  );

@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@Query() query: ListDevicesQuery) {
    return this.devices.list(query);
  }

  @Get(':id')
  get(@DeviceId() id: number) {
    return this.devices.getById(id);
  }

  @Post()
  @UseGuards(DeviceWriteGuard)
  @ResponseMessage('Đã tạo thiết bị')
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Patch(':id')
  @UseGuards(DeviceWriteGuard)
  @ResponseMessage('Đã cập nhật thiết bị')
  update(@DeviceId() id: number, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(DeviceWriteGuard)
  @ResponseMessage('Đã xoá thiết bị')
  remove(@DeviceId() id: number) {
    return this.devices.softDelete(id);
  }
}

/** Danh mục loại thiết bị — mọi user đã đăng nhập đều đọc được. */
@Controller('device-types')
@UseGuards(AuthGuard)
export class DeviceTypesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list() {
    return this.devices.deviceTypes();
  }
}
