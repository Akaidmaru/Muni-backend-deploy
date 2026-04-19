import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MonthlyMaintenanceRecordController } from './monthly-maintenance-record.controller';
import { MonthlyMaintenanceRecordService } from './monthly-maintenance-record.service';

@Module({
  imports: [PrismaModule],
  controllers: [MonthlyMaintenanceRecordController],
  providers: [MonthlyMaintenanceRecordService],
  exports: [MonthlyMaintenanceRecordService],
})
export class MonthlyMaintenanceRecordModule {}
