import {
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateDestinationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe enviar al menos un paciente' })
  @ArrayUnique({ message: 'No se permiten pacientes repetidos' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'El nombre del paciente es obligatorio' })
  @MaxLength(120, {
    each: true,
    message: 'El nombre del paciente no puede superar 120 caracteres',
  })
  @IsOptional()
  patients?: string[];

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
