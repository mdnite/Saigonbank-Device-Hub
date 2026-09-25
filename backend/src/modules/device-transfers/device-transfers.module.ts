import { Module } from '@nestjs/common';
import { DeviceTransfersController } from './device-transfers.controller';
import { DeviceTransfersService } from './device-transfers.service';

@Module({
  controllers: [DeviceTransfersController],
  providers: [DeviceTransfersService],
})
export class DeviceTransfersModule {}
