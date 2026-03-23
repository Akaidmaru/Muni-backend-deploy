import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateOccupationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;
}
