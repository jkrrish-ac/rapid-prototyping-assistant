import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

/**
 * Wraps every successful response in the platform's standard envelope:
 *   { success: true, data: <payload>, message: "" }
 * Errors are wrapped separately by AllExceptionsFilter, per the PRD's
 * "response shape consistency" non-functional requirement.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        message: '',
      })),
    );
  }
}
