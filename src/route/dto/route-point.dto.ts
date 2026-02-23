import { IsNumber } from 'class-validator';

export class RoutePointDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  order: number;
}
