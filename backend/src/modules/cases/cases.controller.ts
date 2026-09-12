import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CasesService } from './cases.service';
import {
  AssignCaseDto,
  CaseQueryDto,
  ChangeStatusDto,
  CloseCaseDto,
  CreateCaseDto,
  ReopenCaseDto,
  UpdateCaseDto,
} from './dto/case.dto';

// Un único controlador para el concepto central "Case". Las pantallas
// /quejas y /solicitudes del frontend consumen estos mismos endpoints
// filtrando por "type" (regla #14/#42): no existen ComplaintController ni
// RequestController duplicados.
@Controller('cases')
@UseGuards(PermissionsGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @RequirePermissions('case:view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: CaseQueryDto) {
    return this.casesService.findAll(user.hotelId, query);
  }

  @Get(':id')
  @RequirePermissions('case:view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.casesService.findOne(user.hotelId, id);
  }

  @Get(':id/history')
  @RequirePermissions('case:view')
  getHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.casesService.getHistory(user.hotelId, id);
  }

  @Post()
  @RequirePermissions('case:create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCaseDto) {
    return this.casesService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('case:edit')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
  ) {
    return this.casesService.update(user.hotelId, id, dto, user);
  }

  @Post(':id/assign')
  @RequirePermissions('case:assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignCaseDto,
  ) {
    return this.casesService.assign(user.hotelId, id, dto, user);
  }

  @Post(':id/status')
  @RequirePermissions('case:change-status')
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.casesService.changeStatus(user.hotelId, id, dto, user);
  }

  @Post(':id/close')
  @RequirePermissions('case:close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseCaseDto,
  ) {
    return this.casesService.close(user.hotelId, id, dto, user);
  }

  @Post(':id/reopen')
  @RequirePermissions('case:reopen')
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReopenCaseDto,
  ) {
    return this.casesService.reopen(user.hotelId, id, dto, user);
  }
}
