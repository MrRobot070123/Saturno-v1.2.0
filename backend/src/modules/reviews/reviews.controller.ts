import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { AddFindingDto, CreateReviewDto, ReviewQueryDto } from './dto/review.dto';

@Controller('reviews')
@UseGuards(PermissionsGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

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