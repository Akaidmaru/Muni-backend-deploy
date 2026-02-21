import { IsInt } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class AssignUserDto {
  @ApiProperty({ example: 1, description: 'ID del usuario a asignar' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 2, description: 'ID del camión al que se asigna el usuario' })

  @IsInt()
  truckId: number;
}
