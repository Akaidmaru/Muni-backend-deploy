import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleMaintenanceRecordDto } from './create-vehicle-maintenance-record.dto';

export class UpdateVehicleMaintenanceRecordDto extends PartialType(
  CreateVehicleMaintenanceRecordDto,
) {}
