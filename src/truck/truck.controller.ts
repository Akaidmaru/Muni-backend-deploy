import {
  Controller,
  Get,
  Post,
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
import { TruckService } from './truck.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { AssignUserDto } from './dto/assign-user.dto';
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
  constructor(private readonly truckService: TruckService) {}

  @Post()
  @Roles('ADMIN', 'DIRECTION')
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
  @Roles('ADMIN', 'DIRECTION')
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
  @Roles('DRIVER', 'ADMIN')
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
  getOutOfServiceAlerts() {
    return this.truckService.getOutOfServiceAlerts();
  }

  @Get(':id/documents')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Listar documentos asociados a un vehiculo' })
  @ApiResponse({
    status: 200,
    description: 'Documentos del vehiculo listados correctamente',
  })
  getDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.truckService.getDocuments(id);
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
    @Param('id', ParseIntPipe) id: number,
    @Param('documentType') documentType: string,
  ) {
    return this.truckService.getDocumentUrl(id, documentType);
  }

  @Post(':id/documents')
  @Roles('ADMIN', 'DIRECTION')
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UploadTruckDocumentDto,
    @UploadedFile() file?: UploadedTruckDocumentFile,
  ) {
    return this.truckService.uploadDocument(id, dto, file);
  }

  @Delete(':id/documents/:documentId')
  @Roles('ADMIN', 'DIRECTION')
  @ApiOperation({ summary: 'Eliminar un documento de vehiculo' })
  @ApiResponse({
    status: 200,
    description: 'Documento del vehiculo eliminado correctamente',
  })
  removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.truckService.removeDocument(id, documentId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DIRECTION')
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.truckService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DIRECTION')
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTruckDto) {
    return this.truckService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DIRECTION')
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
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.truckService.remove(id);
  }

  @Post('assign')
  @Roles('ADMIN', 'DIRECTION')
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
  assignUser(@Body() dto: AssignUserDto) {
    return this.truckService.assignUser(dto);
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
  getUsersOfTruck(@Param('id', ParseIntPipe) id: number) {
    return this.truckService.getUsersOfTruck(id);
  }

  @Post('plate-change')
  @Roles('DRIVER', 'EMPLOYEE', 'ADMIN')
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
