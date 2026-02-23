import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TruckService } from './truck.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { AssignUserDto } from './dto/assign-user.dto';

@ApiBearerAuth()
@Controller('trucks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TruckController {
  constructor(private readonly truckService: TruckService) {}

  @Post()
  @ApiOperation({ summary: 'Crear camión (ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Crear camión (ADMIN)',
    examples: {
      success: {
        summary: 'Camión creado',
        value: { id: 1, plate: 'ABC123', model: 'Volvo FH' },
      },
    },
  })
  create(@Body() dto: CreateTruckDto) {
    return this.truckService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los camiones (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listar todos los camiones (ADMIN)',
    examples: {
      success: {
        summary: 'Camiones listados',
        value: [
          { id: 1, plate: 'ABC123', model: 'Volvo FH' },
          { id: 2, plate: 'DEF456', model: 'Scania R' },
        ],
      },
    },
  })
  findAll() {
    return this.truckService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener camión por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Obtener camión por ID (ADMIN)',
    examples: {
      success: {
        summary: 'Camión encontrado',
        value: { id: 1, plate: 'ABC123', model: 'Volvo FH' },
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.truckService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar camión por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Actualizar camión por ID (ADMIN)',
    examples: {
      success: {
        summary: 'Camión actualizado',
        value: { id: 1, plate: 'DEF456', model: 'Scania R' },
      },
    },
  })
  update(@Param('id') id: string, @Body() dto: UpdateTruckDto) {
    return this.truckService.update(Number(id), dto);
  }

  @Delete(':id')
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
  remove(@Param('id') id: string) {
    return this.truckService.remove(Number(id));
  }

  @Post('assign')
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
  getUsersOfTruck(@Param('id') id: string) {
    return this.truckService.getUsersOfTruck(Number(id));
  }
}
