import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateOccupationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}
