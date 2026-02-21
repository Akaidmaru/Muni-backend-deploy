import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'usuario@email.com' })

  @IsEmail()
  @IsNotEmpty()
  email: string;


  @ApiPropertyOptional({ example: '+573001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'password123', minLength: 6 })

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;


  @IsOptional()
  @IsString()
  name?: string;
}
