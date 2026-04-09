import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class UpdateVerificationEmailDto {
  @ApiProperty({
    example: 'correo-actual@email.com',
    description: 'Correo actual de la cuenta pendiente de verificación',
  })
  @IsEmail()
  @IsNotEmpty()
  oldEmail: string;

  @ApiProperty({
    example: 'correo-nuevo@email.com',
    description: 'Nuevo correo donde se enviará el código de verificación',
  })
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}
