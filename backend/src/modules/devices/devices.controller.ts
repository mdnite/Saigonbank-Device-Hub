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
import { ACTOR, Allow } from '../../shared/auth/actors';
import { AuthGuard } from '../../shared/auth/auth.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import {
  CreateDeviceDto,
  ListDevicesQuery,
  PurgeDevicesDto,
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
  @Allow(ACTOR.TECH_HEAD, ACTOR.TECH_COLLAB)
  @ResponseMessage('Đã tạo thiết bị')
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Patch(':id')
  @Allow(ACTOR.TECH_HEAD, ACTOR.TECH_COLLAB)
  @ResponseMessage('Đã cập nhật thiết bị')
  update(@DeviceId() id: number, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(id, dto);
  }

  /** Xoá mềm — chỉ Trưởng phòng Kỹ thuật; Cộng tác viên thêm/sửa được nhưng không xoá. */
  @Delete(':id')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã xoá thiết bị')
  remove(@DeviceId() id: number) {
    return this.devices.softDelete(id);
  }

  /** Máy Thất lạc (do kiểm kê) được tìm thấy — chỉ Trưởng phòng Kỹ thuật. */
  @Post(':id/found')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã ghi nhận tìm thấy thiết bị')
  found(@DeviceId() id: number) {
    return this.devices.markFound(id);
  }

  /** Dọn thùng rác (xoá cứng) — chỉ Trưởng phòng Kỹ thuật. */
  @Post('purge')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã dọn thùng rác')
  async purge(@Body() dto: PurgeDevicesDto) {
    const count = await this.devices.purge(dto.ids);
    return { count };
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
