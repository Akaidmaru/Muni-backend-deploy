import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationCodeDto {
  @ApiProperty({
    example: 'usuario@email.com',
    description: 'Email al que se enviará el código',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'email',
    description: 'Canal de envío, solo "email" permitido',
  })
  @IsString()
  @IsIn(['email'])
  @IsNotEmpty()
  channel: 'email';
}
