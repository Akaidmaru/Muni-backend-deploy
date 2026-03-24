import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TripHistoryController } from './trip-history.controller';
import { TripHistoryService } from './trip-history.service';

@Module({
  imports: [PrismaModule],
  controllers: [TripHistoryController],
  providers: [TripHistoryService],
})
export class TripHistoryModule {}
