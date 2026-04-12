import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProblemReportDto {
  @IsString()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(3000)
  description!: string;
}
