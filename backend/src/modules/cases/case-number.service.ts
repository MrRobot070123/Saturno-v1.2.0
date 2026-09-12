import { Injectable } from '@nestjs/common';
import { CaseType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Estrategia de numeración (regla #6): NUNCA "MAX(id)+1". Se usa una fila
// dedicada por (hotel, tipo, año) en case_sequences y se bloquea con
// SELECT ... FOR UPDATE dentro de una transacción serializada, de modo que
// si dos usuarios crean un caso al mismo tiempo, el segundo espera hasta que
// el primero libere el bloqueo y recibe el siguiente consecutivo real: no
// hay condición de carrera ni duplicados posibles.
const PREFIX_BY_TYPE: Record<CaseType, string> = {
  QUEJA: 'QUE',
  SOLICITUD: 'SOL',
};

@Injectable()
export class CaseNumberService {
  constructor(private prisma: PrismaService) {}

  async generate(tx: Prisma.TransactionClient, hotelId: string, type: CaseType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = PREFIX_BY_TYPE[type] ?? type.slice(0, 3).toUpperCase();

    // Bloqueo pesimista de fila: si no existe aún la fila del año/tipo, se
    // crea con upsert; luego se bloquea explícitamente con FOR UPDATE antes
    // de incrementarla, todo dentro de la misma transacción que crea el caso.
    await tx.caseSequence.upsert({
      where: { hotelId_type_year: { hotelId, type, year } },
      update: {},
      create: { hotelId, type, year, lastNumber: 0 },
    });

    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      SELECT "lastNumber" FROM case_sequences
      WHERE "hotelId" = ${hotelId} AND "type" = ${type}::"CaseType" AND "year" = ${year}
      FOR UPDATE
    `;
    const current = rows[0]?.lastNumber ?? 0;
    const next = current + 1;

    await tx.caseSequence.update({
      where: { hotelId_type_year: { hotelId, type, year } },
      data: { lastNumber: next },
    });

    const consecutive = String(next).padStart(6, '0');
    return `${prefix}-${year}-${consecutive}`;
  }
}
