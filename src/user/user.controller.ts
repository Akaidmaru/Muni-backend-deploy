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
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserService, UserListItem } from './user.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  private parseRolesQuery(
    rolesParam?: string | string[],
  ): UserRole[] | undefined {
    if (!rolesParam) {
      return undefined;
    }

    const rawRoles = Array.isArray(rolesParam)
      ? rolesParam.flatMap((role) => role.split(','))
      : rolesParam.split(',');

    const normalizedRoles = rawRoles
      .map((role) => role.trim().toUpperCase())
      .filter(Boolean);

    if (normalizedRoles.length === 0) {
      return undefined;
    }

    const validRoles = Object.values(UserRole);
    const invalidRoles = normalizedRoles.filter(
      (role) => !validRoles.includes(role as UserRole),
    );

    if (invalidRoles.length > 0) {
      throw new BadRequestException(
        `Roles inválidos: ${invalidRoles.join(', ')}`,
      );
    }

    return [...new Set(normalizedRoles)] as UserRole[];
  }

  @Get('by-roles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Listar usuarios por uno o varios roles. Solo ADMIN puede incluir el rol ADMIN',
  })
  @ApiResponse({
    status: 200,
    description:
      'Listar usuarios por uno o varios roles. Solo ADMIN puede incluir el rol ADMIN',
    examples: {
      success: {
        summary: 'Usuarios filtrados por rol',
        value: [
          { id: 2, email: 'driver@email.com', role: 'DRIVER' },
          { id: 3, email: 'employee@email.com', role: 'EMPLOYEE' },
        ],
      },
    },
  })
  async getUsersByRoles(
    @Req() req: AuthenticatedRequest,
    @Query('roles') roles?: string | string[],
  ): Promise<UserListItem[]> {
    const parsedRoles = this.parseRolesQuery(roles);
    return this.userService.findByRoles(req.user.id, parsedRoles);
  }

  @Get('me/trucks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar camiones asignados al usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Listar camiones asignados al usuario autenticado',
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
  getMyTrucks(@Req() req: AuthenticatedRequest) {
    return this.userService.getTrucksOfUser(Number(req.user.id));
  }

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
          { id: 2, email: 'employee@email.com', role: 'EMPLOYEE' },
        ],
      },
    },
  })
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.userService.findAll(
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
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

  @Patch(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restablecer contraseña de un usuario (ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña restablecida correctamente',
    examples: {
      success: {
        summary: 'Contraseña restablecida',
        value: { message: 'Contraseña actualizada por el administrador' },
      },
    },
  })
  adminResetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('newPassword') newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 6 caracteres',
      );
    }

    return this.userService.adminResetPassword(id, newPassword) as Promise<{
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
