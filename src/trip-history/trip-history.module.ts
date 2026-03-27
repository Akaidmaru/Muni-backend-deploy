import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { TripHistoryController } from './trip-history.controller';
import { TripHistoryService } from './trip-history.service';

@Module({
  imports: [PrismaModule],
  controllers: [TripHistoryController],
  providers: [TripHistoryService, RolesGuard],
})
export class TripHistoryModule {}
