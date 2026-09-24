import { Module } from '@nestjs/common';
import { DeviceOrdersController } from './device-orders.controller';
import { DeviceOrdersService } from './device-orders.service';

@Module({
  controllers: [DeviceOrdersController],
  providers: [DeviceOrdersService],
})
export class DeviceOrdersModule {}
