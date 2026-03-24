import { IsInt, IsString, Matches, Min } from 'class-validator';

export class StartTripDto {
  @IsString()
  plate: string;

  @IsInt()
  @Min(1)
  destinationId: number;

  @IsInt()
  @Min(1)
  employeeId: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime: string;
}
