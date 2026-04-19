import { Module } from '@nestjs/common';
import { DailyMaintenanceRecordService } from './daily-maintenance-record.service';
import { DailyMaintenanceRecordController } from './daily-maintenance-record.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyMaintenanceRecordController],
  providers: [DailyMaintenanceRecordService],
  exports: [DailyMaintenanceRecordService],
})
export class DailyMaintenanceRecordModule {}
