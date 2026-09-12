import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CaseType, RoleName } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CatalogsService } from './catalogs.service';
import {
  CreateAreaDto,
  CreateLocationDto,
  CreateResponsibleDto,
  CreateSubtypeDto,
  UpdateCatalogItemDto,
} from './dto/catalog.dto';

@Controller()
export class CatalogsController {
  constructor(private catalogsService: CatalogsService) {}

  // ---------- Lectura: cualquier usuario autenticado (necesario para formularios) ----------
  @Get('locations')
  findLocations(@CurrentUser() user: AuthenticatedUser, @Query('onlyActive') onlyActive?: string) {
    return this.catalogsService.findLocations(user.hotelId, onlyActive === 'true');
  }

  @Get('areas')
  findAreas(@CurrentUser() user: AuthenticatedUser, @Query('onlyActive') onlyActive?: string) {
    return this.catalogsService.findAreas(user.hotelId, onlyActive === 'true');
  }

  // Responsables disponibles para un área: se actualiza dinámicamente en el
  // formulario del frontend al cambiar de área (regla #7).
  @Get('areas/:areaId/responsibles')
  findResponsibles(@Param('areaId') areaId: string, @Query('onlyActive') onlyActive?: string) {
    return this.catalogsService.findResponsiblesByArea(areaId, onlyActive !== 'false');
  }

  // ---------- Escritura: solo ADMINISTRADOR ----------
  @Post('locations')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  createLocation(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLocationDto) {
    return this.catalogsService.createLocation(user.hotelId, dto, user.userId);
  }

  @Patch('locations/:id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.updateLocation(id, dto, user.userId);
  }

  @Post('areas')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  createArea(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAreaDto) {
    return this.catalogsService.createArea(user.hotelId, dto, user.userId);
  }

  @Patch('areas/:id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  updateArea(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.updateArea(id, dto, user.userId);
  }

  @Post('responsibles')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  createResponsible(@Body() dto: CreateResponsibleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.createResponsible(dto, user.userId);
  }

  @Patch('responsibles/:id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  updateResponsible(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.updateResponsible(id, dto, user.userId);
  }

  // ---------- Tipos de queja/solicitud (dependen de área + tipo de caso) ----------

  // Usado por el formulario de creación de caso: se recarga cada vez que
  // cambian el área o el tipo (queja/solicitud) seleccionados.
  @Get('case-subtypes')
  findSubtypes(
    @Query('areaId') areaId: string,
    @Query('type') type: CaseType,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.catalogsService.findSubtypes(areaId, type, onlyActive !== 'false');
  }

  // Usado por la pantalla de administración (todas las combinaciones).
  @Get('case-subtypes/all')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  findAllSubtypes(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.findAllSubtypes(user.hotelId);
  }

  @Post('case-subtypes')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  createSubtype(@Body() dto: CreateSubtypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.createSubtype(dto, user.userId);
  }

  @Patch('case-subtypes/:id')
  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMINISTRADOR)
  updateSubtype(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.updateSubtype(id, dto, user.userId);
  }
}
