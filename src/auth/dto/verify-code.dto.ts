import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyCodeDto {
  @ApiPropertyOptional({
    example: 'usuario@email.com',
    description: 'Email para verificar el código',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: '+573001234567',
    description: 'Teléfono para verificar el código',
  })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: '123456',
    description: 'Código de verificación recibido',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
