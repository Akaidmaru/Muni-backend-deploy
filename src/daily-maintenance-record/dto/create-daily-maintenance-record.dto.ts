import {
  IsNumber,
  IsString,
  IsDate,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDailyMaintenanceItemDto } from './create-daily-maintenance-item.dto';

export class CreateDailyMaintenanceRecordDto {
  @IsNumber()
  truckId: number = 0;

  @IsNumber()
  driverId: number = 0;

  @IsDate()
  @Type(() => Date)
  inspectionDate: Date = new Date();

  @IsString()
  inspectionTime: string = ''; // HH:MM

  @IsString()
  municipalLicense: string = '';

  @IsNumber()
  currentMileage: number = 0;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDailyMaintenanceItemDto)
  dailyMaintenanceItems: CreateDailyMaintenanceItemDto[] = [];
}
