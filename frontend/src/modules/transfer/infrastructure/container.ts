import { makeDeviceTransferService } from '../application/DeviceTransferRepository';
import { HttpDeviceTransferRepository } from './HttpDeviceTransferRepository';

export const deviceTransferService = makeDeviceTransferService(new HttpDeviceTransferRepository());
