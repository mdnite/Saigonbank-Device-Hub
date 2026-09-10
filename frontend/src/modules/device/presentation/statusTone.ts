import type { BadgeTone } from '@/shared/ui/Badge';
import type { DeviceStatus } from '../domain/device';

/** UI concern: map a domain status to a badge colour. Kept out of the domain layer. */
export const STATUS_TONE: Record<DeviceStatus, BadgeTone> = {
  IN_STOCK: 'ok',
  ALLOCATED: 'info',
  PENDING_DISPOSAL: 'neutral',
};
