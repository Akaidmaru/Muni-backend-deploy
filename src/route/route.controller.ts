import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { RouteService } from './route.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
// ...existing code...

@Controller('routes')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post()
  create(@Body() dto: CreateRouteDto) {
    return this.routeService.create(dto);
  }

  @Get()
  findAll() {
    return this.routeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const numId = Number(id);
    if (isNaN(numId) || !numId) {
      return { error: 'ID inválido' };
    }
    return this.routeService.findOne(numId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routeService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.routeService.remove(Number(id));
  }

  @Post('snap-to-roads')
  async snapToRoads(
    @Body('points') points: { latitude: number; longitude: number }[],
  ): Promise<{ latitude: number; longitude: number }[]> {
    return await this.routeService.snapToRoads(points);
  }
}
