import type { BadgeTone } from '@/shared/ui/Badge';
import { DEVICE_STATUS, type DeviceStatus } from '../domain/device';

/** UI concern: map a domain status to a badge colour. Kept out of the domain layer. */
export const STATUS_TONE: Record<DeviceStatus, BadgeTone> = {
  [DEVICE_STATUS.IN_STOCK]: 'ok',
  [DEVICE_STATUS.ALLOCATED]: 'info',
  [DEVICE_STATUS.PENDING_DISPOSAL]: 'warn',
  [DEVICE_STATUS.DELETED]: 'danger',
};
