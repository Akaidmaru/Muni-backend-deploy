import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertMonthlyMaintenanceItemDto {
  @IsInt()
  @Min(1)
  @Max(5)
  weekIndex: number = 1;

  @IsString()
  itemCode: string = '';

  @IsString()
  itemName: string = '';

  @IsString()
  category: string = '';

  @IsString()
  status: string = '';

  @IsString()
  @IsOptional()
  notes?: string;
}
