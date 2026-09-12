import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { validate } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { CasesModule } from './modules/cases/cases.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100, // rate limiting global (regla #31); /auth/login tiene su propio guard más estricto
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CatalogsModule,
    CasesModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    // Orden de guards global: JWT primero (autenticación), luego throttling.
    // Los guards de Roles/Permissions se aplican por controlador porque
    // dependen del contexto de cada recurso.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
