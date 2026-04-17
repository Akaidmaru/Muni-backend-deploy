import { IsString, IsOptional } from 'class-validator';

export class CreateDailyMaintenanceItemDto {
  @IsString()
  itemCode: string = '';

  @IsString()
  itemName: string = '';

  @IsString()
  category: string = '';

  @IsString()
  exists: string = ''; // "Si" o "No"

  @IsString()
  status: string = ''; // "Bueno", "Regular", "Malo"

  @IsString()
  @IsOptional()
  notes?: string;
}
