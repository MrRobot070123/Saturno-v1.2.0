import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Servicio único de acceso a datos. Ningún otro módulo debe instanciar
// PrismaClient por su cuenta: todo pasa por aquí (única fuente de conexión,
// facilita logging, transacciones y testing).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida');

    (this as any).$on('error', (e: any) => this.logger.error(e));
    (this as any).$on('warn', (e: any) => this.logger.warn(e));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
