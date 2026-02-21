
import { PartialType } from '@nestjs/mapped-types';
import { AdminCreateUserDto } from './admin-create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/enums';

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
}
