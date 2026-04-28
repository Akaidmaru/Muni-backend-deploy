import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DestinationService } from './destination.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import type { DestinationResponse } from './destination.service';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@Controller('destinations')
export class DestinationController {
  constructor(private readonly destinationService: DestinationService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async findAll(@Req() req: AuthenticatedRequest): Promise<DestinationResponse[]> {
    return await this.destinationService.findAll(Number(req.user.id));
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async findAllActive(@Req() req: AuthenticatedRequest): Promise<DestinationResponse[]> {
    return await this.destinationService.findAllActive(Number(req.user.id));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DestinationResponse> {
    return await this.destinationService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() data: CreateDestinationDto,
  ): Promise<DestinationResponse> {
    return await this.destinationService.create(Number(req.user.id), data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateDestinationDto,
  ): Promise<DestinationResponse> {
    return await this.destinationService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DIRECTION')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DestinationResponse> {
    return await this.destinationService.remove(id);
  }
}
