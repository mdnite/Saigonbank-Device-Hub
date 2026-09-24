import type { BadgeTone } from '@/shared/ui/Badge';
import { ORDER_STATUS, type OrderStatus } from '../domain/deviceOrder';

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  [ORDER_STATUS.PENDING]: 'warn',
  [ORDER_STATUS.APPROVED]: 'ok',
  [ORDER_STATUS.REJECTED]: 'danger',
};
