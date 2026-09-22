import { makeDeviceService } from '../application/DeviceRepository';
import { HttpDeviceRepository } from './HttpDeviceRepository';

export const deviceService = makeDeviceService(new HttpDeviceRepository());
