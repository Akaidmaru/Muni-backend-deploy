import { PartialType } from '@nestjs/mapped-types';
import { CreateTruckDto } from './create-truck.dto';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({
    example: 'Scania',
    description: 'Marca del camión',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    example: 2024,
    description: 'Año del camión',
  })
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Cantidad de asientos del camión',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  seatCount?: number;

  @ApiPropertyOptional({
    example: 130500,
    description: 'Kilometraje actualizado del camión',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage?: number;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha de vencimiento de revisión técnica (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  technicalReviewExpiresAt?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha de vencimiento de permiso de circulación (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  circulationPermitExpiresAt?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha de vencimiento de seguro obligatorio (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  insuranceExpiresAt?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Fecha de vencimiento de emisión de contaminantes (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  emissionsExpiresAt?: string;
}
