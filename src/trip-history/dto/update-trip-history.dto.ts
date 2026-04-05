import { TripHistoryStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpdateTripHistoryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime?: string;

  @IsOptional()
  @IsEnum(TripHistoryStatus)
  status?: TripHistoryStatus;

  @IsOptional()
  @IsNumber()
  startKm?: number;

  @IsOptional()
  @IsNumber()
  endKm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  truckId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  destinationId?: number;
}
