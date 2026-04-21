import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateDailyMaintenanceItemDto {
  @IsString()
  itemCode: string = '';

  @IsString()
  itemName: string = '';

  @IsString()
  category: string = '';

  @IsIn(['Si', 'No'])
  exists: string = '';

  @IsIn(['Bueno', 'Regular', 'Malo'])
  status: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
