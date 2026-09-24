import { makeDeviceOrderService } from '../application/DeviceOrderRepository';
import { HttpDeviceOrderRepository } from './HttpDeviceOrderRepository';

export const deviceOrderService = makeDeviceOrderService(new HttpDeviceOrderRepository());
