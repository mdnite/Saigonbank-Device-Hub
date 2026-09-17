import { SetMetadata } from '@nestjs/common';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message: string;
}

export const RESPONSE_MESSAGE = 'responseMessage';

/** Message trả về trong wrapper khi handler thành công. */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE, message);
