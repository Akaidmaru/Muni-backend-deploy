import {
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationCodeDto {
  @ApiProperty({
    example: 'usuario@email.com',
    description: 'Email al que se enviará el código de verificación',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
