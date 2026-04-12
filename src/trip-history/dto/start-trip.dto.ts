import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;
}
