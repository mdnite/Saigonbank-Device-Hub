import { Module } from '@nestjs/common';
import { DeviceTypesController, DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  controllers: [DevicesController, DeviceTypesController],
  providers: [DevicesService],
})
export class DevicesModule {}
