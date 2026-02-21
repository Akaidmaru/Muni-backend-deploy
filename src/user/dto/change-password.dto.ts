import {
  IsString,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'MatchPasswords', async: false })
export class MatchPasswordsConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const object = args.object as ChangePasswordDto;
    return confirmPassword === object.newPassword;
  }

  defaultMessage() {
    return 'Las contraseñas no coinciden';
  }
}

export class ChangePasswordDto {

  @ApiProperty({ example: 'oldPassword123', description: 'Contraseña actual del usuario' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword456', description: 'Nueva contraseña del usuario' })

  @IsString()
  @MinLength(6, {
    message: 'La nueva contraseña debe tener al menos 6 caracteres',
  })
  newPassword: string;


  @IsString()
  @Validate(MatchPasswordsConstraint)
  confirmPassword: string;
}
