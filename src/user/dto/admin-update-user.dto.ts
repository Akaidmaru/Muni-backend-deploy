import { PartialType } from '@nestjs/swagger';
import { AdminCreateUserDto } from './admin-create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsInt, IsOptional } from 'class-validator';

export class AdminUpdateUserDto extends PartialType(AdminCreateUserDto) {
  @ApiPropertyOptional({
    example: 'nuevo@email.com',
    description: 'Nuevo email del usuario',
  })
  email?: string;

  @ApiPropertyOptional({
    example: '+573001234567',
    description: 'Nuevo teléfono del usuario',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'Juan Actualizado',
    description: 'Nuevo nombre del usuario',
  })
  name?: string;

  @ApiPropertyOptional({
    example: UserRole.ADMIN,
    enum: UserRole,
    description: 'Nuevo rol del usuario',
  })
  role?: UserRole;

  @ApiPropertyOptional({
    example: 10,
    description: 'ID del usuario que gestiona la cuenta',
  })
  @IsOptional()
  @IsInt({ message: 'El ID del usuario gestor debe ser un número entero' })
  managedById?: number | null;
}
