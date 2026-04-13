import { ApiProperty } from '@nestjs/swagger';
import { PlateChangeReason } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class RegisterPlateChangeDto {
  @ApiProperty({
    example: 1,
    description: 'ID del camión al que se le registra cambio de patente',
  })
  @IsInt()
  @Min(1)
  truckId: number;

  @ApiProperty({
    enum: PlateChangeReason,
    example: PlateChangeReason.AVERIA,
    description: 'Motivo del cambio de patente',
  })
  @IsEnum(PlateChangeReason)
  reason: PlateChangeReason;

  @ApiProperty({
    example: 'Se detecta falla en sistema de frenos, se reemplaza camión.',
    description: 'Observaciones del cambio de patente',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  observations: string;
}