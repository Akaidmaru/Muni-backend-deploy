import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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

  @ApiProperty({
    example: 125000,
    description: 'Kilometraje actual del camión',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage?: number;
}
