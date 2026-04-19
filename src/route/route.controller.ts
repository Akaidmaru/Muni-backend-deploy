import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoogleRoadsService } from './googleRoads.service';

@Controller('routes')
export class RouteController {
  constructor(private readonly googleRoadsService: GoogleRoadsService) {}

  @Post('snap-to-roads')
  @UseGuards(JwtAuthGuard)
  async snapToRoads(
    @Body('points') points: { latitude: number; longitude: number }[],
  ) {
    const result = await this.googleRoadsService.snapToRoads(points);
    return result;
  }
}
