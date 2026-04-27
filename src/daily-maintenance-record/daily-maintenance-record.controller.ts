import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DailyMaintenanceRecordService } from './daily-maintenance-record.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateDailyMaintenanceRecordDto,
  UpdateDailyMaintenanceRecordDto,
  UpdateDailyMaintenanceStatusDto,
} from './dto';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

const parseDateOnlyOrThrow = (dateStr: string): Date => {
  const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new BadRequestException('Formato de fecha inválido. Use YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException('Formato de fecha inválido. Use YYYY-MM-DD');
  }

  return parsed;
};

@ApiBearerAuth()
@Controller('daily-maintenance-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DailyMaintenanceRecordController {
  constructor(
    private readonly DailyMaintenanceRecordService: DailyMaintenanceRecordService,
  ) {}

  @Post()
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({
    summary: 'Crear registro de mantenimiento diario del vehículo',
  })
  @ApiResponse({
    status: 201,
    description: 'Registro de mantenimiento creado exitosamente',
  })
  async create(@Body() dto: CreateDailyMaintenanceRecordDto) {
    return await this.DailyMaintenanceRecordService.create(dto);
  }

  @Get()
  @Roles('EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar todos los registros de mantenimiento' })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros de mantenimiento',
  })
  async findAll(@Req() req: AuthenticatedRequest) {
    return await this.DailyMaintenanceRecordService.findAll(Number(req.user.id));
  }

  @Get('admin')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar todos los registros de mantenimiento (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros de mantenimiento (solo ADMIN)',
  })
  async findAllAdmin(@Req() req: AuthenticatedRequest) {
    return await this.DailyMaintenanceRecordService.findAll(Number(req.user.id));
  }

  @Get('truck/:truckId')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Obtener registros de mantenimiento por vehículo' })
  @ApiResponse({
    status: 200,
    description: 'Registros de mantenimiento del vehículo',
  })
  async findByTruck(@Param('truckId', ParseIntPipe) truckId: number) {
    return await this.DailyMaintenanceRecordService.findByTruck(truckId);
  }

  @Get('truck/:truckId/date')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({
    summary: 'Obtener registro de mantenimiento por vehículo y fecha',
  })
  @ApiResponse({
    status: 200,
    description:
      'Registro de mantenimiento del vehículo en la fecha especificada',
  })
  async findByTruckAndDate(
    @Param('truckId', ParseIntPipe) truckId: number,
    @Query('date') dateStr: string,
  ) {
    const date = parseDateOnlyOrThrow(dateStr);
    return await this.DailyMaintenanceRecordService.findByTruckAndDate(
      truckId,
      date,
    );
  }

  @Get('driver/:driverId/date')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({
    summary: 'Obtener registro de mantenimiento por conductor y fecha',
  })
  @ApiResponse({
    status: 200,
    description:
      'Registro de mantenimiento del conductor en la fecha especificada',
  })
  async findByDriverAndDate(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query('date') dateStr: string,
  ) {
    const date = parseDateOnlyOrThrow(dateStr);
    return await this.DailyMaintenanceRecordService.findByDriverAndDate(
      driverId,
      date,
    );
  }

  @Get('driver/:driverId/truck/:truckId/date')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({
    summary:
      'Obtener registro de mantenimiento por conductor, vehículo y fecha',
  })
  @ApiResponse({
    status: 200,
    description:
      'Registro de mantenimiento del conductor para ese vehículo en la fecha especificada',
  })
  async findByDriverTruckAndDate(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Param('truckId', ParseIntPipe) truckId: number,
    @Query('date') dateStr: string,
  ) {
    const date = parseDateOnlyOrThrow(dateStr);
    return await this.DailyMaintenanceRecordService.findByDriverTruckAndDate(
      driverId,
      truckId,
      date,
    );
  }

  @Get('mileage-suggestion/:truckId')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({
    summary: 'Obtener sugerencia de kilometraje actual del vehículo',
  })
  @ApiResponse({
    status: 200,
    description: 'Kilometraje sugerido para el formulario',
  })
  async getMileageSuggestion(@Param('truckId', ParseIntPipe) truckId: number) {
    return await this.DailyMaintenanceRecordService.getTruckMileageSuggestion(
      truckId,
    );
  }

  @Get('mileage-suggestion/plate/:plate')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({
    summary:
      'Obtener sugerencia de kilometraje actual del vehículo por patente',
  })
  @ApiResponse({
    status: 200,
    description: 'Kilometraje sugerido para el formulario',
  })
  async getMileageSuggestionByPlate(@Param('plate') plate: string) {
    return await this.DailyMaintenanceRecordService.getTruckMileageSuggestionByPlate(
      plate,
    );
  }

  @Get(':id')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Obtener registro de mantenimiento por ID' })
  @ApiResponse({
    status: 200,
    description: 'Detalles del registro de mantenimiento',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.DailyMaintenanceRecordService.findOne(id);
  }

  @Get('admin/:id')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Obtener registro de mantenimiento por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Detalles del registro de mantenimiento (solo ADMIN)',
  })
  async findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return await this.DailyMaintenanceRecordService.findOne(id);
  }

  @Patch('admin/:id/status')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Actualizar estado diario (solo ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Estado del registro diario actualizado correctamente',
  })
  async updateStatusAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDailyMaintenanceStatusDto,
  ) {
    return await this.DailyMaintenanceRecordService.updateStatusAdmin(
      id,
      dto.status,
    );
  }

  @Patch(':id')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Actualizar registro de mantenimiento' })
  @ApiResponse({
    status: 200,
    description: 'Registro de mantenimiento actualizado',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDailyMaintenanceRecordDto,
  ) {
    return await this.DailyMaintenanceRecordService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Eliminar registro de mantenimiento (solo ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Registro de mantenimiento eliminado',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.DailyMaintenanceRecordService.remove(id);
  }
}
