import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RoutePointDto } from './route-point.dto';

export class CreateRouteDto {
  @IsString()
  origin: string;

  @IsString()
  destiny: string;

  @IsNumber()
  truckId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  points: RoutePointDto[];
}
