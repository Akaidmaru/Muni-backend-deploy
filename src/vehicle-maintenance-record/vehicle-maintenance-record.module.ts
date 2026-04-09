import { Module } from '@nestjs/common';
import { VehicleMaintenanceRecordService } from './vehicle-maintenance-record.service';
import { VehicleMaintenanceRecordController } from './vehicle-maintenance-record.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VehicleMaintenanceRecordController],
  providers: [VehicleMaintenanceRecordService],
  exports: [VehicleMaintenanceRecordService],
})
export class VehicleMaintenanceRecordModule {}
