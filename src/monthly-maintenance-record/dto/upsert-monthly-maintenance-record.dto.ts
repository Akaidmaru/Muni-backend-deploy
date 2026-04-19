import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Matches, ValidateNested } from 'class-validator';
import { UpsertMonthlyMaintenanceItemDto } from './upsert-monthly-maintenance-item.dto';

export class UpsertMonthlyMaintenanceRecordDto {
  @IsInt()
  truckId: number = 0;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  monthKey: string = '';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertMonthlyMaintenanceItemDto)
  monthlyMaintenanceItems: UpsertMonthlyMaintenanceItemDto[] = [];
}
