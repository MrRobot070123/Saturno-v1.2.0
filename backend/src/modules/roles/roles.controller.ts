import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { RoleName } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RolesService } from './roles.service';

class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionCodes: string[];
}

@Controller('roles')
@UseGuards(RolesGuard)
@Roles(RoleName.ADMINISTRADOR)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findRoles();
  }

  @Get('permissions')
  findPermissions() {
    return this.rolesService.findPermissions();
  }

  @Patch(':id/permissions')
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.updateRolePermissions(id, dto.permissionCodes, user.userId);
  }
}
