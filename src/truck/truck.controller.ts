import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  Req,
  ParseIntPipe,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TruckExpiryService } from './truck-expiry.service';
import { TruckService } from './truck.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { SetTruckUsersDto } from './dto/set-truck-users.dto';
import { RegisterPlateChangeDto } from './dto/register-plate-change.dto';
import { UploadTruckDocumentDto } from './dto/upload-truck-document.dto';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

type UploadedTruckDocumentFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

@ApiBearerAuth()
@Controller('trucks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TruckController {
  constructor(
    private readonly truckService: TruckService,
    private readonly truckExpiryService: TruckExpiryService,
  ) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear camión (ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Crear camión (ADMIN)',
    examples: {
      success: {
        summary: 'Camión creado',
        value: { id: 1, plate: 'ABC123', model: 'Volvo FH', mileage: 125000 },
      },
    },
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTruckDto) {
    return this.truckService.create(Number(req.user.id), dto);
  }

  @Get()
  @Roles('ADMIN', 'DIRECTION', 'DRIVER')
  @ApiOperation({ summary: 'Listar todos los camiones (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listar todos los camiones (ADMIN)',
    examples: {
      success: {
        summary: 'Camiones listados',
        value: [
          { id: 1, plate: 'ABC123', model: 'Volvo FH', mileage: 125000 },
          { id: 2, plate: 'DEF456', model: 'Scania R', mileage: 98000 },
        ],
      },
    },
  })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.truckService.findAll(Number(req.user.id));
  }

  @Get('unassigned')
  @Roles('DRIVER', 'ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar camiones sin asignar a conductores (DRIVER/ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Camiones sin asignar',
    examples: {
      success: {
        summary: 'Camiones sin asignar listados',
        value: [
          { id: 1, plate: 'ABC123' },
          { id: 2, plate: 'DEF456' },
        ],
      },
    },
  })
  findUnassigned(@Req() req: AuthenticatedRequest) {
    return this.truckService.findUnassigned(Number(req.user.id));
  }

  @Get('expiry-notifications')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Alertas de vencimiento de documentos de camiones para hoy (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listado de documentos que vencen en 1 o 7 días',
  })
  getExpiryNotifications() {
    return this.truckExpiryService.getExpiryNotificationPayloads();
  }

  @Get('out-of-service-alerts')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({
    summary:
      'Listar vehículos fuera de servicio por avería (último evento por camión).',
  })
  @ApiResponse({
    status: 200,
    description: 'Alertas de fuera de servicio por avería',
  })
  getOutOfServiceAlerts(@Req() req: AuthenticatedRequest) {
    return this.truckService.getOutOfServiceAlerts(Number(req.user.id));
  }

  @Get(':id/documents')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar documentos asociados a un vehiculo' })
  @ApiResponse({
    status: 200,
    description: 'Documentos del vehiculo listados correctamente',
  })
  getDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.truckService.getDocuments(Number(req.user.id), id);
  }

  @Get(':id/documents/:documentType/url')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({
    summary: 'Obtener URL firmada del documento de un vehiculo por tipo',
  })
  @ApiResponse({
    status: 200,
    description: 'URL firmada generada correctamente',
  })
  getDocumentUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('documentType') documentType: string,
  ) {
    return this.truckService.getDocumentUrl(Number(req.user.id), id, documentType);
  }

  @Post(':id/documents')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ];
        if (!allowed.includes((file.mimetype || '').toLowerCase())) {
          return cb(new Error('Tipo de archivo no permitido'), false);
        }
        return cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Subir o reemplazar un documento de vehiculo' })
  @ApiResponse({
    status: 201,
    description: 'Documento del vehiculo subido correctamente',
  })
  uploadDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UploadTruckDocumentDto,
    @UploadedFile() file?: UploadedTruckDocumentFile,
  ) {
    return this.truckService.uploadDocument(Number(req.user.id), id, dto, file);
  }

  @Delete(':id/documents/:documentId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un documento de vehiculo' })
  @ApiResponse({
    status: 200,
    description: 'Documento del vehiculo eliminado correctamente',
  })
  removeDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.truckService.removeDocument(Number(req.user.id), id, documentId);
  }

  @Get('managed-by-my-manager')
  @Roles('DRIVER', 'ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar camiones administrados por el gestor del conductor autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Camiones del gestor del conductor autenticado',
  })
  findManagedByMyManager(@Req() req: AuthenticatedRequest) {
    return this.truckService.findManagedByMyManager(Number(req.user.id));
  }

  @Get(':id')
  @Roles('ADMIN', 'DIRECTION', 'DRIVER')
  @ApiOperation({ summary: 'Obtener camión por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Obtener camión por ID (ADMIN)',
    examples: {
      success: {
        summary: 'Camión encontrado',
        value: { id: 1, plate: 'ABC123', model: 'Volvo FH', mileage: 125000 },
      },
    },
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.truckService.findOne(Number(req.user.id), id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar camión por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Actualizar camión por ID (ADMIN)',
    examples: {
      success: {
        summary: 'Camión actualizado',
        value: { id: 1, plate: 'DEF456', model: 'Scania R', mileage: 130500 },
      },
    },
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTruckDto,
  ) {
    return this.truckService.update(Number(req.user.id), id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar camión por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Eliminar camión por ID (ADMIN)',
    examples: {
      success: {
        summary: 'Camión eliminado',
        value: { message: 'Camión eliminado correctamente' },
      },
    },
  })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.truckService.remove(Number(req.user.id), id);
  }

  @Post('assign')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Asignar usuario a camión (ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Asignar usuario a camión (ADMIN)',
    examples: {
      success: {
        summary: 'Usuario asignado',
        value: { id: 1, userId: 2, truckId: 1 },
      },
    },
  })
  assignUser(@Req() req: AuthenticatedRequest, @Body() dto: AssignUserDto) {
    return this.truckService.assignUser(Number(req.user.id), dto);
  }

  @Get(':id/users')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar usuarios asignados a un camión (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listar usuarios asignados a un camión (ADMIN)',
    examples: {
      success: {
        summary: 'Usuarios asignados',
        value: [
          { id: 1, email: 'user1@email.com', name: 'Juan' },
          { id: 2, email: 'user2@email.com', name: 'Ana' },
        ],
      },
    },
  })
  getUsersOfTruck(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.truckService.getUsersOfTruck(Number(req.user.id), id);
  }

  @Put(':id/users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Sincronizar conductores asignados a un camión' })
  @ApiResponse({
    status: 200,
    description: 'Conductores sincronizados correctamente',
  })
  setUsersOfTruck(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetTruckUsersDto,
  ) {
    return this.truckService.setUsersOfTruck(Number(req.user.id), id, dto.userIds);
  }

  @Post('plate-change')
  @Roles('DRIVER', 'ADMIN')
  @ApiOperation({
    summary:
      'Registrar cambio de patente. Si el motivo es AVERIA, el camión queda INACTIVE.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cambio de patente registrado correctamente',
  })
  registerPlateChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterPlateChangeDto,
  ) {
    return this.truckService.registerPlateChange(Number(req.user.id), dto);
  }
}
