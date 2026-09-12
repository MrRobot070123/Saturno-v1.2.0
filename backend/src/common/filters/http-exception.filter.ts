import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Manejo centralizado de errores (regla #35). Reglas duras:
// - NUNCA se envía stack trace, secretos, ni mensajes crudos de Postgres/Prisma.
// - Todo error no controlado se traduce a un mensaje genérico y amigable.
// - Se loguea internamente el detalle completo para diagnóstico (regla #37),
//   sin registrar contraseñas ni tokens.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Ocurrió un error inesperado. Intenta nuevamente.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (body as any).message ?? 'Ocurrió un error inesperado.';
    } else if (exception instanceof Error) {
      // Errores de Prisma u otros: no se propagan al cliente, solo se loguean.
      this.logger.error(
        `${request.method} ${request.url} -> ${exception.message}`,
        exception.stack,
      );
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
