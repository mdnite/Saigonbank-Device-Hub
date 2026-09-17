import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { ApiResponse, RESPONSE_MESSAGE } from './api-response';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const message =
      this.reflector.get<string | undefined>(
        RESPONSE_MESSAGE,
        context.getHandler(),
      ) ?? 'Thành công';
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        error: null,
        message,
      })),
    );
  }
}
