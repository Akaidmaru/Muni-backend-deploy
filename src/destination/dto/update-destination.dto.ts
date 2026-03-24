import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDestinationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  name?: string;
}
