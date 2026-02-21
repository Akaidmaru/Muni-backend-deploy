import { PartialType } from '@nestjs/mapped-types';
import { CreateTruckDto } from './create-truck.dto';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTruckDto extends PartialType(CreateTruckDto) {
  @ApiPropertyOptional({
    example: 'DEF456',
    description: 'Placa nueva del camión',
  })
  plate?: string;

  @ApiPropertyOptional({
    example: 'Scania R',
    description: 'Modelo nuevo del camión',
  })
  model?: string;
}

