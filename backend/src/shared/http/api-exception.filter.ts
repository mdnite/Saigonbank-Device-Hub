import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiResponse } from './api-response';

/** Bọc MỌI lỗi (kể cả lỗi không lường trước) vào cùng shape ApiResponse. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (!(exception instanceof HttpException)) this.logger.error(exception);
    const http =
      exception instanceof HttpException
        ? exception
        : new InternalServerErrorException(
            'Lỗi hệ thống, vui lòng thử lại sau',
          );

    const status = http.getStatus();
    const body = http.getResponse();
    const raw =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] }).message;
    const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? http.message);

    const payload: ApiResponse<null> = {
      success: false,
      data: null,
      error: HttpStatus[status] ?? 'ERROR',
      message,
    };
    host.switchToHttp().getResponse<Response>().status(status).json(payload);
  }
}
