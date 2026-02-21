import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/enums';

export class AdminCreateUserDto {
  @ApiProperty({ example: 'admin@email.com', description: 'Email del usuario' })

  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;


  @ApiPropertyOptional({
    example: '+573001234567',
    description: 'Teléfono del usuario',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'password123',
    description: 'Contraseña del usuario',
  })

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;


  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Nombre del usuario',
  })

  @IsOptional()
  @IsString()
  name?: string;


  @ApiPropertyOptional({
    example: UserRole.ADMIN,
    enum: UserRole,
    description: 'Rol del usuario',
  })

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser CLIENT, DRIVER o ADMIN' })
  role?: UserRole;
}
