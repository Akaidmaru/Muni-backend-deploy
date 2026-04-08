import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { GoogleRoadsService } from './googleRoads.service';

@Controller('routes')
export class RouteController {
  constructor(private readonly googleRoadsService: GoogleRoadsService) {}

  @Post('snap-to-roads')
  async snapToRoads(
    @Body('points') points: { latitude: number; longitude: number }[],
  ) {
    const result = await this.googleRoadsService.snapToRoads(points);
    return result;
  }
}
