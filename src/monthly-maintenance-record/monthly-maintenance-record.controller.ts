import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonthlyMaintenanceRecordService } from './monthly-maintenance-record.service';
import {
  UpsertMonthlyMaintenanceRecordDto,
  UpdateMonthlyMaintenanceStatusDto,
} from './dto';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@ApiBearerAuth()
@Controller('monthly-maintenance-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonthlyMaintenanceRecordController {
  constructor(
    private readonly monthlyMaintenanceRecordService: MonthlyMaintenanceRecordService,
  ) {}

  @Get('admin')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar mantenimientos mensuales (solo ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listado mensual de mantenimiento vehicular',
  })
  async findAllAdmin(@Req() req: AuthenticatedRequest) {
    return await this.monthlyMaintenanceRecordService.findAllAdmin(Number(req.user.id));
  }

  @Get('admin/truck/:truckId/month')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({
    summary: 'Obtener mantenimiento mensual por camión y mes (solo ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro mensual para un camión y mes (YYYY-MM)',
  })
  async findAdminByTruckAndMonth(
    @Req() req: AuthenticatedRequest,
    @Param('truckId', ParseIntPipe) truckId: number,
    @Query('month') month: string,
  ) {
    if (!month) {
      throw new BadRequestException(
        'El parámetro month es obligatorio en formato YYYY-MM',
      );
    }

    return await this.monthlyMaintenanceRecordService.findAdminByTruckAndMonth(
      Number(req.user.id),
      truckId,
      month,
    );
  }

  @Post('admin')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Crear o actualizar mantenimiento mensual (solo ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Registro mensual creado o actualizado correctamente',
  })
  async upsertAdmin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertMonthlyMaintenanceRecordDto,
  ) {
    return await this.monthlyMaintenanceRecordService.upsertAdmin(
      Number(req.user.id),
      dto,
    );
  }

  @Patch('admin/:id/status')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Actualizar estado mensual (solo ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Estado del registro mensual actualizado correctamente',
  })
  async updateStatusAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMonthlyMaintenanceStatusDto,
  ) {
    return await this.monthlyMaintenanceRecordService.updateStatusAdmin(
      Number(req.user.id),
      id,
      dto.status,
    );
  }
}
