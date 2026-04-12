import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class CreateTripHistoryPointDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}

export class CreateTripHistoryPointsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTripHistoryPointDto)
  points!: CreateTripHistoryPointDto[];
}