import {
  Param,
  Controller,
  Body,
  Get,
  Post,
  Patch,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  @Get('verified')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar usuarios verificados | Status (true || false) | (ADMIN) ',
  })
  @ApiResponse({
    status: 200,
    description:
      'Listar usuarios verificados | Status (true || false) | (ADMIN) ',
    examples: {
      success: {
        summary: 'Usuarios verificados',
        value: [
          { id: 1, email: 'admin@email.com', verified: true },
          { id: 2, email: 'user@email.com', verified: true },
        ],
      },
    },
  })
  async getUsersByVerificationStatus(@Query('status') status: string) {
    return this.userService.findByVerificationStatus(status);
  }

  @Get(':id/trucks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar camiones asignados a un usuario (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listar camiones asignados a un usuario (ADMIN)',
    examples: {
      success: {
        summary: 'Camiones asignados',
        value: [
          { id: 1, plate: 'ABC123', model: 'Volvo FH' },
          { id: 2, plate: 'DEF456', model: 'Scania R' },
        ],
      },
    },
  })
  getTrucksOfUser(@Param('id') id: string) {
    return this.userService.getTrucksOfUser(Number(id));
  }
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear usuario por administrador' })
  @ApiResponse({
    status: 201,
    description: 'Crear usuario por administrador',
    examples: {
      success: {
        summary: 'Usuario creado',
        value: { id: 1, email: 'nuevo@email.com', role: 'ADMIN' },
      },
    },
  })
  adminCreate(@Body() dto: AdminCreateUserDto) {
    return this.userService.adminCreate(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos los usuarios (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Listar todos los usuarios (ADMIN)',
    examples: {
      success: {
        summary: 'Usuarios listados',
        value: [
          { id: 1, email: 'admin@email.com', role: 'ADMIN' },
          { id: 2, email: 'user@email.com', role: 'CLIENT' },
        ],
      },
    },
  })
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario por ID (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Obtener usuario por ID (ADMIN)',
    examples: {
      success: {
        summary: 'Usuario encontrado',
        value: { id: 1, email: 'admin@email.com', role: 'ADMIN' },
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(Number(id));
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Cambiar contraseña del usuario autenticado',
    examples: {
      success: {
        summary: 'Contraseña cambiada',
        value: { message: 'Contraseña actualizada correctamente' },
      },
    },
  })
  @ApiBearerAuth()
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(req.user.id, dto) as Promise<{
      message: string;
    }>;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Actualizar usuario por administrador' })
  @ApiResponse({
    status: 200,
    description: 'Actualizar usuario por administrador',
    examples: {
      success: {
        summary: 'Usuario actualizado',
        value: { id: 1, email: 'actualizado@email.com', role: 'DRIVER' },
      },
    },
  })
  @ApiBearerAuth()
  @Roles('ADMIN')
  adminUpdateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.userService.adminUpdateUser(Number(id), dto);
  }
}
