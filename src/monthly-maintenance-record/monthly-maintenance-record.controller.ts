import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonthlyMaintenanceRecordService } from './monthly-maintenance-record.service';
import { UpsertMonthlyMaintenanceRecordDto } from './dto';

@ApiBearerAuth()
@Controller('monthly-maintenance-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonthlyMaintenanceRecordController {
  constructor(
    private readonly monthlyMaintenanceRecordService: MonthlyMaintenanceRecordService,
  ) {}

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar mantenimientos mensuales (solo ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listado mensual de mantenimiento vehicular',
  })
  async findAllAdmin() {
    return await this.monthlyMaintenanceRecordService.findAllAdmin();
  }

  @Get('admin/truck/:truckId/month')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Obtener mantenimiento mensual por camión y mes (solo ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Registro mensual para un camión y mes (YYYY-MM)',
  })
  async findAdminByTruckAndMonth(
    @Param('truckId', ParseIntPipe) truckId: number,
    @Query('month') month: string,
  ) {
    if (!month) {
      throw new BadRequestException(
        'El parámetro month es obligatorio en formato YYYY-MM',
      );
    }

    return await this.monthlyMaintenanceRecordService.findAdminByTruckAndMonth(
      truckId,
      month,
    );
  }

  @Post('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear o actualizar mantenimiento mensual (solo ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Registro mensual creado o actualizado correctamente',
  })
  async upsertAdmin(
    @Body() dto: UpsertMonthlyMaintenanceRecordDto,
  ) {
    return await this.monthlyMaintenanceRecordService.upsertAdmin(dto);
  }
}
