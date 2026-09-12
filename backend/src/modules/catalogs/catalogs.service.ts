import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toAuditJson } from '../../common/utils/audit-json.util';
import {
  CreateAreaDto,
  CreateLocationDto,
  CreateResponsibleDto,
  CreateSubtypeDto,
  UpdateCatalogItemDto,
} from './dto/catalog.dto';

// Todos los catálogos (ubicaciones, áreas, responsables) son ampliables
// desde la UI de administración sin requerir cambios de código ni
// migraciones (regla #7). "isActive" permite desactivar sin borrar
// historial de casos que ya los referencian (integridad referencial).
@Injectable()
export class CatalogsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ---------- LOCATIONS ----------
  findLocations(hotelId: string, onlyActive = false) {
    return this.prisma.location.findMany({
      where: { hotelId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(hotelId: string, dto: CreateLocationDto, actingUserId: string) {
    const existing = await this.prisma.location.findFirst({
      where: { hotelId, name: dto.name },
    });
    if (existing) throw new ConflictException('Ya existe una ubicación con ese nombre');

    const location = await this.prisma.location.create({ data: { hotelId, name: dto.name } });
    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_CREATE',
      entity: 'Location',
      entityId: location.id,
      newValues: { name: location.name },
    });
    return location;
  }

  async updateLocation(id: string, dto: UpdateCatalogItemDto, actingUserId: string) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ubicación no encontrada');

    const updated = await this.prisma.location.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_UPDATE',
      entity: 'Location',
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: toAuditJson({ name: dto.name, isActive: dto.isActive }),
    });
    return updated;
  }

  // ---------- AREAS ----------
  findAreas(hotelId: string, onlyActive = false) {
    return this.prisma.area.findMany({
      where: { hotelId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async createArea(hotelId: string, dto: CreateAreaDto, actingUserId: string) {
    const existing = await this.prisma.area.findFirst({ where: { hotelId, name: dto.name } });
    if (existing) throw new ConflictException('Ya existe un área con ese nombre');

    const area = await this.prisma.area.create({ data: { hotelId, name: dto.name } });
    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_CREATE',
      entity: 'Area',
      entityId: area.id,
      newValues: { name: area.name },
    });
    return area;
  }

  async updateArea(id: string, dto: UpdateCatalogItemDto, actingUserId: string) {
    const existing = await this.prisma.area.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Área no encontrada');

    const updated = await this.prisma.area.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_UPDATE',
      entity: 'Area',
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: toAuditJson({ name: dto.name, isActive: dto.isActive }),
    });
    return updated;
  }

  // ---------- RESPONSIBLES (dependen dinámicamente del área) ----------
  findResponsiblesByArea(areaId: string, onlyActive = false) {
    return this.prisma.responsible.findMany({
      where: { areaId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { fullName: 'asc' },
    });
  }

  async createResponsible(dto: CreateResponsibleDto, actingUserId: string) {
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId } });
    if (!area) throw new NotFoundException('Área no encontrada');

    const responsible = await this.prisma.responsible.create({
      data: { areaId: dto.areaId, fullName: dto.fullName, userId: dto.userId },
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_CREATE',
      entity: 'Responsible',
      entityId: responsible.id,
      newValues: { fullName: responsible.fullName, areaId: dto.areaId },
    });
    return responsible;
  }

  async updateResponsible(id: string, dto: UpdateCatalogItemDto, actingUserId: string) {
    const existing = await this.prisma.responsible.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Responsable no encontrado');

    const updated = await this.prisma.responsible.update({
      where: { id },
      data: { fullName: dto.fullName, isActive: dto.isActive },
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_UPDATE',
      entity: 'Responsible',
      entityId: id,
      oldValues: { fullName: existing.fullName, isActive: existing.isActive },
      newValues: toAuditJson({ fullName: dto.fullName, isActive: dto.isActive }),
    });
    return updated;
  }

  // ---------- CASE SUBTYPES (tipo de queja/solicitud, según área + tipo) ----------
  findSubtypes(areaId: string, type: CaseType, onlyActive = true) {
    return this.prisma.caseSubtype.findMany({
      where: { areaId, type, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  // Todas las combinaciones (para la pantalla de administración), agrupadas
  // implícitamente por área+tipo desde el frontend.
  findAllSubtypes(hotelId: string) {
    return this.prisma.caseSubtype.findMany({
      where: { area: { hotelId } },
      include: { area: { select: { id: true, name: true } } },
      orderBy: [{ area: { name: 'asc' } }, { type: 'asc' }, { name: 'asc' }],
    });
  }

  async createSubtype(dto: CreateSubtypeDto, actingUserId: string) {
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId } });
    if (!area) throw new NotFoundException('Área no encontrada');

    const existing = await this.prisma.caseSubtype.findFirst({
      where: { areaId: dto.areaId, type: dto.type, name: dto.name },
    });
    if (existing) throw new ConflictException('Ya existe ese tipo para esta área y tipo de caso');

    const subtype = await this.prisma.caseSubtype.create({
      data: { areaId: dto.areaId, type: dto.type, name: dto.name },
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_CREATE',
      entity: 'CaseSubtype',
      entityId: subtype.id,
      newValues: { areaId: dto.areaId, type: dto.type, name: dto.name },
    });
    return subtype;
  }

  async updateSubtype(id: string, dto: UpdateCatalogItemDto, actingUserId: string) {
    const existing = await this.prisma.caseSubtype.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo no encontrado');

    const updated = await this.prisma.caseSubtype.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'CATALOG_UPDATE',
      entity: 'CaseSubtype',
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: toAuditJson({ name: dto.name, isActive: dto.isActive }),
    });
    return updated;
  }
}
