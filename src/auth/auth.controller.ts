import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user-dto';
import { LoginDto } from './dto/login-dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { CheckVerificationStatusDto } from './dto/check-verification-status.dto';
import { UpdateVerificationEmailDto } from './dto/update-verification-email.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: number };
}

interface CurrentUserResponse {
  id: number;
  email: string;
  name: string | null;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('occupations')
  @ApiOperation({ summary: 'Listar ocupaciones disponibles para registro' })
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
  async getOccupations(): Promise<Array<{ id: number; name: string }>> {
    const occupationsUnknown: unknown = await this.authService.getOccupations();
    if (!Array.isArray(occupationsUnknown)) {
      throw new InternalServerErrorException('Formato de ocupaciones inválido');
    }

    const occupations = occupationsUnknown
      .filter((item): item is { id: number; name: string } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const record = item as Record<string, unknown>;
        return typeof record.id === 'number' && typeof record.name === 'string';
      })
      .map((item) => ({ id: item.id, name: item.name }));

    return occupations;
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiBody({
    description: 'Datos para registrar un nuevo usuario',
    required: true,
    schema: {
      example: {
        email: 'ejemplo@email.com',
        name: 'Ejemplo Nombre',
        phone: '+573001234567',
        password: 'contraseña123',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Registrar nuevo usuario',
    examples: {
      success: {
        summary: 'Usuario registrado',
        value: {
          id: 1,
          email: 'nuevo@email.com',
          name: 'Nuevo Usuario',
          phone: '+573001112233',
        },
      },
    },
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('send-verification-code')
  @ApiOperation({ summary: 'Enviar código de verificación por email' })
  @ApiResponse({
    status: 201,
    description: 'Enviar código de verificación por email',
    examples: {
      success: {
        summary: 'Código enviado',
        value: { message: 'Código de verificación enviado al correo.' },
      },
    },
  })
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    return this.authService.sendVerificationCode(dto);
  }

  @Post('verify-code')
  @ApiOperation({ summary: 'Verificar código recibido por email' })
  @ApiResponse({
    status: 200,
    description: 'Verificar código recibido por email',
    examples: {
      success: {
        summary: 'Código verificado',
        value: { message: 'Código verificado correctamente.' },
      },
    },
  })
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Post('verification-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consultar si un usuario está verificado' })
  @ApiBody({
    description: 'Email del usuario a consultar',
    required: true,
    type: CheckVerificationStatusDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de verificación del usuario',
    examples: {
      success: {
        summary: 'Estado consultado',
        value: { email: 'usuario@email.com', isVerified: true },
      },
    },
  })
  async getVerificationStatus(@Body() dto: CheckVerificationStatusDto) {
    return this.authService.getVerificationStatus(dto.email);
  }

  @Post('update-verification-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar correo pendiente de verificación' })
  @ApiBody({
    description: 'Correo actual y nuevo correo para reenviar código',
    required: true,
    type: UpdateVerificationEmailDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Correo actualizado y código reenviado',
    examples: {
      success: {
        summary: 'Correo actualizado',
        value: {
          message: 'Correo de verificación actualizado y código reenviado',
          email: 'nuevo@email.com',
        },
      },
    },
  })
  async updateVerificationEmail(@Body() dto: UpdateVerificationEmailDto) {
    return this.authService.updateVerificationEmail(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener JWT' })
  @ApiResponse({ status: 200, description: 'Iniciar sesión y obtener JWT' })
  @ApiResponse({
    status: 200,
    description: 'Iniciar sesión y obtener JWT',
    examples: {
      success: {
        summary: 'Login exitoso',
        value: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 1,
            email: 'usuario@email.com',
            name: 'Usuario',
            phone: '+573001112233',
          },
        },
      },
    },
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtener datos del usuario autenticado',
    description:
      'Este endpoint requiere el token JWT en el header Authorization: Bearer <token>',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del usuario autenticado',
    examples: {
      success: {
        summary: 'Usuario obtenido',
        value: {
          id: 1,
          email: 'usuario@email.com',
          name: 'Usuario',
          role: 'DRIVER',
        },
      },
    },
  })
  async getCurrentUser(
    @Req() req: AuthenticatedRequest,
  ): Promise<CurrentUserResponse> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Usuario no encontrado en token');
    }
    return await this.authService.getCurrentUser(userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión y revocar JWT',
    description:
      'Este endpoint requiere el token JWT en el header Authorization: Bearer <token>',
  })
  @ApiResponse({ status: 200, description: 'Cerrar sesión y revocar JWT' })
  @ApiResponse({
    status: 200,
    description: 'Cerrar sesión y revocar JWT',
    examples: {
      success: {
        summary: 'Sesión cerrada',
        value: { message: 'Sesión cerrada correctamente.' },
      },
    },
  })
  async logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.headers.authorization);
  }
}
