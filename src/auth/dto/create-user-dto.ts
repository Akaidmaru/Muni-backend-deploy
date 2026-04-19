import { Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'occupationId debe ser un entero' })
  @Min(1, { message: 'occupationId debe ser mayor que 0' })
  occupationId?: number;

  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El RUT es requerido' })
  rut: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
