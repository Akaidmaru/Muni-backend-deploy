import { MonthlyMaintenanceRecordStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMonthlyMaintenanceStatusDto {
  @IsEnum(MonthlyMaintenanceRecordStatus)
  status: MonthlyMaintenanceRecordStatus = MonthlyMaintenanceRecordStatus.PENDING;
}
