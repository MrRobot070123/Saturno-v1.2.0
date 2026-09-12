import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  // Headers de seguridad (regla #31).
  app.use(helmet());

  // CORS correctamente configurado: solo el origen del frontend conocido,
  // nunca "*" en un sistema con autenticación real.
  app.enableCors({
    origin: config.get('FRONTEND_URL'),
    credentials: true,
  });

  // Validación global de entrada (regla #30): cualquier campo no declarado
  // en el DTO se rechaza (whitelist + forbidNonWhitelisted), y los tipos se
  // transforman automáticamente. Nunca se confía solo en la validación de
  // Angular.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${port}/api/v1`);
}

bootstrap();
