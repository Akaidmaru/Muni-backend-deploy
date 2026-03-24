import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDestinationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
