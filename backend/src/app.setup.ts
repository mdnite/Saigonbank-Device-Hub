import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiExceptionFilter } from './shared/http/api-exception.filter';
import { ResponseInterceptor } from './shared/http/response.interceptor';

/** Cấu hình dùng chung cho main.ts và test, để test chạy đúng pipeline như production. */
export function setupApp(app: INestApplication) {
  // transform: query string → number cho các DTO có @Type(() => Number).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new ApiExceptionFilter());
}
