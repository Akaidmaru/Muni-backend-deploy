import { IsNotEmpty, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CreateTruckDto {
  @ApiProperty({ example: 'ABC123', description: 'Placa del camión' })
  @IsString()
  @IsNotEmpty()
  plate: string;

  @ApiProperty({ example: 'Volvo FH', description: 'Modelo del camión' })

  @IsString()
  @IsNotEmpty()
  model: string;
}
