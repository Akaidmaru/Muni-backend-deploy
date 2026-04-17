import { PartialType } from '@nestjs/mapped-types';
import { CreateDailyMaintenanceRecordDto } from './create-vehicle-maintenance-record.dto';

export class UpdateDailyMaintenanceRecordDto extends PartialType(
  CreateDailyMaintenanceRecordDto,
) {}
