import { makeDeviceService } from '../application/DeviceRepository';
import { InMemoryDeviceRepository } from './InMemoryDeviceRepository';

export const deviceService = makeDeviceService(new InMemoryDeviceRepository());
