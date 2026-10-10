import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewClassifierService } from './review-classifier.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewClassifierService],
  exports: [ReviewsService],
})
export class ReviewsModule {}