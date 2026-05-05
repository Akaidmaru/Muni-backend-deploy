import { PartialType } from '@nestjs/mapped-types';
import { CreateTruckDto } from './create-truck.dto';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TruckStatus } from '@prisma/client';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTruckDto extends PartialType(CreateTruckDto) {
  @ApiPropertyOptional({
    example: 'DEF456',
    description: 'Placa nueva del camión',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  plate?: string;

  @ApiPropertyOptional({
    example: 'Scania R',
    description: 'Modelo nuevo del camión',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  model?: string;

  @ApiPropertyOptional({
    example: 'Scania',
    description: 'Marca del camión',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  brand?: string;

  @ApiPropertyOptional({
    example: 2024,
    description: 'Año del camión',
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  })
  year?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Cantidad de asientos del camión',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  })
  seatCount?: number;

  @ApiPropertyOptional({
    example: 130500,
    description: 'Kilometraje actualizado del camión',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  })
  mileage?: number;

  @ApiPropertyOptional({
    enum: TruckStatus,
    example: TruckStatus.INACTIVE,
    description: 'Estado operativo del camión',
  })
  @IsOptional()
  @IsEnum(TruckStatus)
  status?: TruckStatus;

  @ApiPropertyOptional({
    example: 4,
    description: 'ID del usuario gestor ADMIN o DIRECTION',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => {
    if (value === null) return null;
    if (value === '' || value === undefined) {
      return undefined;
    }
    return Number(value);
  })
  managedById?: number | null;

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
