import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateServiceRequestDto {
  @IsIn(['conductor', 'patente'])
  tipo: string;

  @ValidateIf((dto: CreateServiceRequestDto) => dto.tipo === 'conductor')
  @IsIn(['anadir', 'baja'])
  conductorOpcion?: string;

  @ValidateIf((dto: CreateServiceRequestDto) => dto.tipo === 'conductor')
  @IsString()
  @MaxLength(160)
  nombre?: string;

  @ValidateIf((dto: CreateServiceRequestDto) => dto.tipo === 'patente')
  @IsString()
  @MaxLength(20)
  patente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  razon?: string;
}
