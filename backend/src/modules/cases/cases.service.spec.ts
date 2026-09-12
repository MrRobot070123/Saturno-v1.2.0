import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CaseStatus } from '@prisma/client';
import { CasesService } from './cases.service';

describe('CasesService - máquina de estados', () => {
  let service: CasesService;
  let prisma: any;

  const baseCase = {
    id: 'case-1',
    hotelId: 'hotel-1',
    status: CaseStatus.SIN_RESOLVER,
    areaId: 'area-1',
    responsibleId: null,
    description: 'desc',
    locationId: 'loc-1',
    priority: 'MEDIA',
  };

  beforeEach(() => {
    prisma = {
      case: {
        findFirst: jest.fn().mockResolvedValue(baseCase),
        update: jest.fn().mockImplementation(({ data }) => ({ ...baseCase, ...data })),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      }),
      caseHistory: { create: jest.fn() },
      caseAudit: { create: jest.fn() },
    };

    const caseNumberService = {} as any;
    const audit = { log: jest.fn() } as any;
    const notifications = {
      notifyStatusChanged: jest.fn(),
      notifyResponsibleAssigned: jest.fn(),
    } as any;

    service = new CasesService(prisma, caseNumberService, audit, notifications);
  });

  const user = {
    userId: 'u1',
    email: 'u@x.com',
    hotelId: 'hotel-1',
    roles: ['OPERATIVO'],
    permissions: ['case:change-status', 'case:close', 'case:reopen'],
  };

  it('permite SIN_RESOLVER -> EN_PROCESO', async () => {
    const result = await service.changeStatus('hotel-1', 'case-1', { status: CaseStatus.EN_PROCESO }, user);
    expect(result.status).toBe(CaseStatus.EN_PROCESO);
  });

  it('rechaza SIN_RESOLVER -> RESUELTO por el endpoint genérico (debe usar close)', async () => {
    await expect(
      service.changeStatus('hotel-1', 'case-1', { status: CaseStatus.RESUELTO }, user),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza REABIERTO directo desde SIN_RESOLVER', async () => {
    await expect(
      service.reopen('hotel-1', 'case-1', { reason: 'motivo' }, user),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite EN_PROCESO -> RESUELTO vía close() con observación', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...baseCase, status: CaseStatus.EN_PROCESO });
    const result = await service.close('hotel-1', 'case-1', { resolutionNote: 'Se solucionó' }, user);
    expect(result.status).toBe(CaseStatus.RESUELTO);
    expect(result.resolutionNote).toBe('Se solucionó');
  });

  it('permite RESUELTO -> REABIERTO solo con permiso case:reopen', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...baseCase, status: CaseStatus.RESUELTO });
    const result = await service.reopen('hotel-1', 'case-1', { reason: 'el huésped reportó que persiste' }, user);
    expect(result.status).toBe(CaseStatus.REABIERTO);
  });

  it('rechaza reapertura sin el permiso case:reopen', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...baseCase, status: CaseStatus.RESUELTO });
    const userSinPermiso = { ...user, permissions: [] };
    await expect(
      service.reopen('hotel-1', 'case-1', { reason: 'motivo' }, userSinPermiso),
    ).rejects.toThrow(ForbiddenException);
  });

  it('bloquea edición libre de un caso resuelto sin permiso especial', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...baseCase, status: CaseStatus.RESUELTO });
    const userSinPermiso = { ...user, permissions: [] };
    await expect(
      service.update('hotel-1', 'case-1', { description: 'nueva descripción larga' }, userSinPermiso),
    ).rejects.toThrow(ForbiddenException);
  });
});
