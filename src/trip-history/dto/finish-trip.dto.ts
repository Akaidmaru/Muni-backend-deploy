import { IsString, Matches } from 'class-validator';

export class FinishTripDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime: string;
}
