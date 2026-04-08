import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RouteModule } from '../route/route.module';
import { TripHistoryController } from './trip-history.controller';
import { TripHistoryService } from './trip-history.service';

@Module({
  imports: [PrismaModule, CommonModule, RouteModule],
  controllers: [TripHistoryController],
  providers: [TripHistoryService, RolesGuard],
})
export class TripHistoryModule {}
