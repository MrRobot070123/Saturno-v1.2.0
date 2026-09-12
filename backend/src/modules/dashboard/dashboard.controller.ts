import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('dashboard')
@UseGuards(PermissionsGuard)
@RequirePermissions('dashboard:view')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.summary(user.hotelId, query);
  }

  @Get('charts')
  charts(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.charts(user.hotelId, query);
  }
}
