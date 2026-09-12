import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: any;
  let jwt: JwtService;
  let audit: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      passwordResetToken: { create: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { log: jest.fn() };
    jwt = new JwtService({ secret: 'test-secret' });
    const config = new ConfigService({
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_EXPIRES_IN: '7d',
    });

    authService = new AuthService(prisma as PrismaService, jwt, config, audit as AuditService);
  });

  it('debe autenticar con credenciales correctas y emitir tokens', async () => {
    const passwordHash = await argon2.hash('ClaveSegura123');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@hotel.com',
      passwordHash,
      isActive: true,
      hotelId: 'hotel-1',
      fullName: 'Usuario Test',
    });

    const result = await authService.login('test@hotel.com', 'ClaveSegura123', '127.0.0.1');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN', userId: 'user-1' }),
    );
  });

  it('debe rechazar credenciales incorrectas sin revelar si el correo existe', async () => {
    const passwordHash = await argon2.hash('ClaveSegura123');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@hotel.com',
      passwordHash,
      isActive: true,
      hotelId: 'hotel-1',
    });

    await expect(
      authService.login('test@hotel.com', 'ClaveIncorrecta', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
  });

  it('debe rechazar login de usuario inactivo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@hotel.com',
      passwordHash: 'irrelevant',
      isActive: false,
    });

    await expect(authService.login('test@hotel.com', 'cualquier-cosa')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe rechazar un refresh token expirado o revocado (sesión expirada)', async () => {
    const refreshToken = jwt.sign({ sub: 'user-1' }, {
      secret: 'test-refresh-secret',
      expiresIn: '7d',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      revoked: true,
      expiresAt: new Date(Date.now() + 100000),
    });

    await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
