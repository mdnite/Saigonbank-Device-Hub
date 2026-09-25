import type { BadgeTone } from '@/shared/ui/Badge';
import { TRANSFER_STATUS, type TransferStatus } from '../domain/deviceTransfer';

export const TRANSFER_STATUS_TONE: Record<TransferStatus, BadgeTone> = {
  [TRANSFER_STATUS.PENDING]: 'warn',
  [TRANSFER_STATUS.APPROVED]: 'ok',
  [TRANSFER_STATUS.REJECTED]: 'danger',
};
