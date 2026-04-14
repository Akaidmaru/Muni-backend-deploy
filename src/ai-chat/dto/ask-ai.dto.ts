import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AskAiDto {
  @ApiProperty({
    description: 'Consulta en lenguaje natural sobre la base de datos.',
    example: 'Dame los 5 primeros camiones',
  })
  @IsString()
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de resultados por consulta.',
    example: 5,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}