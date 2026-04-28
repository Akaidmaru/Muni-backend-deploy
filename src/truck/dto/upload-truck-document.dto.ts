import { ApiProperty } from '@nestjs/swagger';
import { TruckDocumentType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UploadTruckDocumentDto {
  @ApiProperty({
    enum: TruckDocumentType,
    example: TruckDocumentType.TECHNICAL_REVIEW,
    description: 'Tipo de documento asociado al vehiculo',
  })
  @IsEnum(TruckDocumentType)
  documentType: TruckDocumentType;
}
