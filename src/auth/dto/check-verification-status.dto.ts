import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class CheckVerificationStatusDto {
  @ApiProperty({
    example: 'usuario@email.com',
    description: 'Email del usuario a consultar',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
