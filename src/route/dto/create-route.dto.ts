import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RoutePointDto } from './route-point.dto';

export class CreateRouteDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsNumber()
  truckId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  points: RoutePointDto[];
}
