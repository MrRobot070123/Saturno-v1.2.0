import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { AddFindingDto, ApproveFindingDto, CreateReviewDto, ReviewQueryDto } from './dto/review.dto';

@Controller('reviews')
@UseGuards(PermissionsGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // IMPORTANTE: estas dos rutas van ANTES de ':id' — si quedaran después,
  // Nest tomaría "findings" como si fuera el :id de GET /reviews/:id.
  @Get('findings/pending')
  @RequirePermissions('review:classification-approve')
  findPendingFindings(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.findPendingFindings(user.hotelId);
  }

  @Patch('findings/:id/approve')
  @RequirePermissions('review:classification-approve')
  approveFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveFindingDto,
  ) {
    return this.reviewsService.approveFinding(user.hotelId, id, dto, user);
  }

  @Patch('findings/:id/reject')
  @RequirePermissions('review:classification-approve')
  rejectFinding(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reviewsService.rejectFinding(user.hotelId, id, user);
  }

  @Get()
  @RequirePermissions('review:view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ReviewQueryDto) {
    return this.reviewsService.findAll(user.hotelId, query);
  }

  @Get(':id')
  @RequirePermissions('review:view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reviewsService.findOne(user.hotelId, id);
  }

  @Post()
  @RequirePermissions('review:create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user, dto);
  }

  @Post(':id/findings')
  @RequirePermissions('review:create')
  addFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddFindingDto,
  ) {
    return this.reviewsService.addFinding(user.hotelId, id, dto, user);
  }
}