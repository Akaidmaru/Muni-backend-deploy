import { DailyMaintenanceRecordStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDailyMaintenanceStatusDto {
  @IsEnum(DailyMaintenanceRecordStatus)
  status: DailyMaintenanceRecordStatus = DailyMaintenanceRecordStatus.PENDING;
}
