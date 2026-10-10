import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL: string;

  // Opcional: sin esta clave, la clasificación automática de reseñas con IA
  // (Fase B) simplemente no corre — la reseña queda guardada con aiError,
  // pero el resto del sistema sigue funcionando con normalidad.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ANTHROPIC_API_KEY?: string;
}

// Se ejecuta una sola vez al iniciar Nest (ConfigModule.forRoot({ validate })).
// Si falta o está vacía una variable crítica, la app NO debe arrancar:
// preferimos un fallo inmediato y explícito a un backend corriendo sin
// secretos configurados (regla de seguridad #31/#32 del proyecto).
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Configuración de entorno inválida:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return validatedConfig;
}