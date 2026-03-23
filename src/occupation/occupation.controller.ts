import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OccupationService } from './occupation.service';
import { CreateOccupationDto } from './dto/create-occupation.dto';
import { UpdateOccupationDto } from './dto/update-occupation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('occupations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OccupationController {
  constructor(private readonly occupationService: OccupationService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear una nueva ocupación' })
  @ApiBody({
    description: 'Datos para crear una ocupación',
    type: CreateOccupationDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Ocupación creada exitosamente',
    schema: {
      example: { id: 1, name: 'Student' },
    },
  })
  async create(@Body() createOccupationDto: CreateOccupationDto) {
    return this.occupationService.create(createOccupationDto);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar todas las ocupaciones' })
  @ApiResponse({
    status: 200,
    description: 'Listado de ocupaciones',
    schema: {
      example: [
        { id: 1, name: 'Student' },
        { id: 2, name: 'Employee' },
      ],
    },
  })
  async findAll() {
    return this.occupationService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Obtener una ocupación por ID' })
  @ApiResponse({
    status: 200,
    description: 'Ocupación encontrada',
    schema: {
      example: { id: 1, name: 'Student' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Ocupación no encontrada',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.occupationService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar una ocupación' })
  @ApiBody({
    description: 'Datos a actualizar',
    type: UpdateOccupationDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Ocupación actualizada',
    schema: {
      example: { id: 1, name: 'Updated Name' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Ocupación no encontrada',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOccupationDto: UpdateOccupationDto,
  ) {
    return this.occupationService.update(id, updateOccupationDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar una ocupación' })
  @ApiResponse({
    status: 200,
    description: 'Ocupación eliminada',
    schema: {
      example: { id: 1, name: 'Student' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Ocupación no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'No se puede eliminar porque hay usuarios asociados',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.occupationService.remove(id);
  }
}
