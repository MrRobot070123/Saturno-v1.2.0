import { Prisma } from '@prisma/client';

// Los DTOs con campos opcionales (ej. UpdateCaseDto, UpdateCatalogItemDto)
// tienen propiedades tipadas como "string | undefined". Prisma exige que
// los campos Json (oldValues/newValues en la auditoría) nunca reciban
// "undefined" como valor de una propiedad (JSON no tiene ese concepto).
// Esta utilidad limpia esos valores antes de guardarlos, preservando el
// comportamiento esperado: solo se registran los campos que sí vinieron
// en la petición.
export function toAuditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {}));
}
