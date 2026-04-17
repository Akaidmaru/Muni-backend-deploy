import { PartialType } from '@nestjs/mapped-types';
import { CreateDailyMaintenanceRecordDto } from './create-daily-maintenance-record.dto';

export class UpdateDailyMaintenanceRecordDto extends PartialType(
  CreateDailyMaintenanceRecordDto,
) {}
