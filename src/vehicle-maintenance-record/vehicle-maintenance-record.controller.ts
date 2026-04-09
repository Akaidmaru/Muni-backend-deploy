import {
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VehicleMaintenanceRecordService } from './vehicle-maintenance-record.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateVehicleMaintenanceRecordDto,
  UpdateVehicleMaintenanceRecordDto,
} from './dto';

@ApiBearerAuth()
@Controller('vehicle-maintenance-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehicleMaintenanceRecordController {
  constructor(
    private readonly vehicleMaintenanceRecordService: VehicleMaintenanceRecordService,
  ) {}

  @Post()
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
  @ApiOperation({
    summary: 'Crear registro de mantenimiento diario del vehículo',
  })
  @ApiResponse({
    status: 201,
    description: 'Registro de mantenimiento creado exitosamente',
  })
  async create(@Body() dto: CreateVehicleMaintenanceRecordDto) {
    return await this.vehicleMaintenanceRecordService.create(dto);
  }

  @Get()
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Listar todos los registros de mantenimiento' })
  @ApiResponse({
    status: 200,
    description: 'Lista de registros de mantenimiento',
  })
  async findAll() {
    return await this.vehicleMaintenanceRecordService.findAll();
  }

  @Get('truck/:truckId')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Obtener registros de mantenimiento por vehículo' })
  @ApiResponse({
    status: 200,
    description: 'Registros de mantenimiento del vehículo',
  })
  async findByTruck(@Param('truckId', ParseIntPipe) truckId: number) {
    return await this.vehicleMaintenanceRecordService.findByTruck(truckId);
  }

  @Get('truck/:truckId/date')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
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
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Formato de fecha inválido');
    }
    return await this.vehicleMaintenanceRecordService.findByTruckAndDate(
      truckId,
      date,
    );
  }

  @Get('driver/:driverId/date')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
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
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Formato de fecha inválido');
    }
    return await this.vehicleMaintenanceRecordService.findByDriverAndDate(
      driverId,
      date,
    );
  }

  @Get('driver/:driverId/truck/:truckId/date')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
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
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Formato de fecha inválido');
    }
    return await this.vehicleMaintenanceRecordService.findByDriverTruckAndDate(
      driverId,
      truckId,
      date,
    );
  }

  @Get('mileage-suggestion/:truckId')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
  @ApiOperation({
    summary: 'Obtener sugerencia de kilometraje actual del vehículo',
  })
  @ApiResponse({
    status: 200,
    description: 'Kilometraje sugerido para el formulario',
  })
  async getMileageSuggestion(@Param('truckId', ParseIntPipe) truckId: number) {
    return await this.vehicleMaintenanceRecordService.getTruckMileageSuggestion(
      truckId,
    );
  }

  @Get('mileage-suggestion/plate/:plate')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
  @ApiOperation({
    summary:
      'Obtener sugerencia de kilometraje actual del vehículo por patente',
  })
  @ApiResponse({
    status: 200,
    description: 'Kilometraje sugerido para el formulario',
  })
  async getMileageSuggestionByPlate(@Param('plate') plate: string) {
    return await this.vehicleMaintenanceRecordService.getTruckMileageSuggestionByPlate(
      plate,
    );
  }

  @Get(':id')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Obtener registro de mantenimiento por ID' })
  @ApiResponse({
    status: 200,
    description: 'Detalles del registro de mantenimiento',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.vehicleMaintenanceRecordService.findOne(id);
  }

  @Patch(':id')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar registro de mantenimiento' })
  @ApiResponse({
    status: 200,
    description: 'Registro de mantenimiento actualizado',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleMaintenanceRecordDto,
  ) {
    return await this.vehicleMaintenanceRecordService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar registro de mantenimiento (solo ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Registro de mantenimiento eliminado',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.vehicleMaintenanceRecordService.remove(id);
  }
}
