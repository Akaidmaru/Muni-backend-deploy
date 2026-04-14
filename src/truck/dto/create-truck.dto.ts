import {
  IsDateString,
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
    example: 'Volvo',
    description: 'Marca del camión',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({
    example: 2024,
    description: 'Año del camión',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiProperty({
    example: 2,
    description: 'Cantidad de asientos del camión',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  seatCount?: number;

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

  @ApiProperty({
    example: '2026-12-31',
    description: 'Fecha de vencimiento de revisión técnica (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  technicalReviewExpiresAt?: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'Fecha de vencimiento de permiso de circulación (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  circulationPermitExpiresAt?: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'Fecha de vencimiento de seguro obligatorio (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  insuranceExpiresAt?: string;

  @ApiProperty({
    example: '2026-12-31',
    description:
      'Fecha de vencimiento de emisión de contaminantes (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  emissionsExpiresAt?: string;
}
