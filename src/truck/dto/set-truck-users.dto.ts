import { ArrayUnique, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SetTruckUsersDto {
  @ApiProperty({
    example: [2, 5],
    description: 'IDs de usuarios conductores que quedarán asignados al camión',
    type: [Number],
  })
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  userIds: number[];
}
