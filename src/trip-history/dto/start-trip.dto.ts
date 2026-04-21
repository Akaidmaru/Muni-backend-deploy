import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class StartTripDto {
  @IsString()
  plate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  destinationId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customDestination?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customEmployee?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  clientDate?: string;
}
