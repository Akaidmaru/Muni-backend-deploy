import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FinishTripDto } from './dto/finish-trip.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { TripHistoryService } from './trip-history.service';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@Controller('trip-history')
@UseGuards(JwtAuthGuard)
export class TripHistoryController {
  constructor(private readonly tripHistoryService: TripHistoryService) {}

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('name') name?: string,
    @Query('license') license?: string,
  ): Promise<unknown> {
    const parsedPage = Number(page) || 1;
    const parsedPageSize = Number(pageSize) || 10;

    const tripHistories: unknown = await this.tripHistoryService.findAll({
      page: parsedPage,
      pageSize: parsedPageSize,
      from,
      to,
      name,
      license,
    });

    return tripHistories;
  }

  @Get()
  async findByUserAccess(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('name') name?: string,
    @Query('license') license?: string,
  ): Promise<unknown> {
    const parsedPage = Number(page) || 1;
    const parsedPageSize = Number(pageSize) || 10;

    const tripHistories: unknown =
      await this.tripHistoryService.findByUserAccess(req.user.id, {
        page: parsedPage,
        pageSize: parsedPageSize,
        from,
        to,
        name,
        license,
      });
    return tripHistories;
  }

  @Post('start')
  async startTrip(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartTripDto,
  ): Promise<unknown> {
    const tripHistory: unknown = await this.tripHistoryService.startTrip(
      req.user.id,
      dto,
    );
    return tripHistory;
  }

  @Patch(':id/finish')
  async finishTrip(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinishTripDto,
  ): Promise<unknown> {
    const tripHistory: unknown = await this.tripHistoryService.finishTrip(
      req.user.id,
      id,
      dto,
    );
    return tripHistory;
  }
}
