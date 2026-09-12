import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface TokenPayload {
  sub: string;
  email: string;
  hotelId: string;
  roles: string[];
  permissions: string[];
}

// Autenticación real (regla #13): passwords con hash argon2 (nunca texto
// plano), access token de corta duración, refresh token de larga duración
// almacenado únicamente como HASH en base de datos (si la BD se filtra, los
// refresh tokens no son reutilizables directamente), expiración de sesión,
// y recuperación de contraseña vía token de un solo uso.
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buildPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const permissionsSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.code);
      }
    }
    return { roles, permissions: Array.from(permissionsSet) };
  }

  private async issueTokens(userId: string, email: string, hotelId: string, ip?: string) {
    const { roles, permissions } = await this.buildPermissions(userId);
    const payload: TokenPayload = { sub: userId, email, hotelId, roles, permissions };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN'),
    });

    const refreshToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // coherente con JWT_REFRESH_EXPIRES_IN=7d por defecto

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(refreshToken), expiresAt, ip },
    });

    return { accessToken, refreshToken, roles, permissions };
  }

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Mensaje deliberadamente genérico: no revelar si el correo existe o no.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        ip,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.hotelId, ip);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ip,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        hotelId: user.hotelId,
        roles: tokens.roles,
        permissions: tokens.permissions,
      },
    };
  }

  async refresh(refreshToken: string, ip?: string) {
    let decoded: { sub: string };
    try {
      decoded = this.jwt.verify(refreshToken, { secret: this.config.get('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Sesión expirada, inicia sesión nuevamente');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada, inicia sesión nuevamente');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    // Rotación de refresh token: se revoca el usado y se emite uno nuevo.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.hotelId, ip);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(userId: string, refreshToken: string | undefined, ip?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revoked: true },
      });
    }
    await this.audit.log({ userId, action: 'LOGOUT', entity: 'User', entityId: userId, ip });
    return { message: 'Sesión cerrada correctamente' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const matches = await argon2.verify(user.passwordHash, currentPassword);
    if (!matches) throw new UnauthorizedException('La contraseña actual no es correcta');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    }); // fuerza a re-loguear en todos los dispositivos

    await this.audit.log({ userId, action: 'PASSWORD_CHANGE', entity: 'User', entityId: userId });
    return { message: 'Contraseña actualizada correctamente' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Respuesta idéntica exista o no el usuario, para no filtrar información.
    if (!user) return { message: 'Si el correo existe, se enviarán instrucciones' };

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: this.hashToken(rawToken), expiresAt },
    });

    // En este entorno de desarrollo no hay integración de correo real
    // configurada (regla #48: no inventar integraciones externas). El token
    // se loguea para pruebas; en producción debe enviarse por correo.
    this.logger.warn(
      `[DEV ONLY] Token de recuperación para ${email}: ${rawToken} (expira en 30 min)`,
    );

    return { message: 'Si el correo existe, se enviarán instrucciones' };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('El enlace de recuperación no es válido o ha expirado');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId },
        data: { revoked: true },
      }),
    ]);

    await this.audit.log({
      userId: stored.userId,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: stored.userId,
    });

    return { message: 'Contraseña restablecida correctamente' };
  }
}
