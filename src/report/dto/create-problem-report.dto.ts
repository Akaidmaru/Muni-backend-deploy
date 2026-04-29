import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProblemReportDto {
  @IsString({ message: 'El titulo debe ser texto.' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'El titulo es obligatorio.' })
  @MinLength(2, { message: 'El titulo debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'El titulo no puede superar 120 caracteres.' })
  title!: string;

  @IsString({ message: 'La descripcion debe ser texto.' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'La descripcion es obligatoria.' })
  @MinLength(5, {
    message: 'La descripcion debe tener al menos 5 caracteres.',
  })
  @MaxLength(3000, {
    message: 'La descripcion no puede superar 3000 caracteres.',
  })
  description!: string;
}
