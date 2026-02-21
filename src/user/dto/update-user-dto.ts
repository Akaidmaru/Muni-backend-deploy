import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user-dto';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'usuario@email.com' })
  email?: string;

  @ApiPropertyOptional({ example: '+573001234567' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  name?: string;
}

