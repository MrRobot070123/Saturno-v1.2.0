import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Logging estructurado de cada request (regla #37). Nunca registra
// contraseñas, tokens ni secretos: solo método, ruta, usuario, status y
// duración.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl } = req;
    const userId = req.user?.userId ?? 'anon';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${originalUrl} ${res.statusCode} - ${Date.now() - start}ms - user:${userId}`,
          );
        },
        error: (err) => {
          this.logger.warn(
            `${method} ${originalUrl} ERROR(${err?.status ?? 500}) - ${Date.now() - start}ms - user:${userId}`,
          );
        },
      }),
    );
  }
}
