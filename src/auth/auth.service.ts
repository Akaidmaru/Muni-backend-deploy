import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user-dto';
import { LoginDto } from './dto/login-dto';
import { UpdateVerificationEmailDto } from './dto/update-verification-email.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { MailService } from '../common/mail.service';

interface JwtPayloadWithExp {
  exp: number;
}

interface OccupationListItem {
  id: number;
  name: string;
}

interface OccupationIdOnly {
  id: number;
}

interface OccupationWithName {
  id: number;
  name: string;
}

interface CurrentUserResponse {
  id: number;
  email: string;
  rut: string;
  name: string | null;
  role: string;
  managedById: number | null;
  managedByRole: string | null;
}

interface OccupationDelegate {
  findMany(args: {
    orderBy: { name: 'asc' | 'desc' };
    select: { id: true; name: true };
  }): Promise<OccupationListItem[]>;
  findUnique(args: {
    where: { id: number };
    select: { id: true; name: true };
  }): Promise<OccupationWithName | null>;
}

@Injectable()
export class AuthService {
  private readonly verificationRateLimitSeconds = Number(
    process.env.VERIFICATION_RATE_LIMIT_SECONDS ?? 60,
  );

  private getOccupationDelegate(): OccupationDelegate {
    return this.prisma.occupation as unknown as OccupationDelegate;
  }
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private mailService: MailService,
  ) {}

  getOccupations(): Promise<OccupationListItem[]> {
    const occupationDelegate = this.getOccupationDelegate();

    return occupationDelegate.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async register(data: CreateUserDto) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedRut = data.rut.trim().toUpperCase();
    const normalizedPhone = data.phone?.trim() || undefined;
    const role: UserRole = UserRole.PENDING_APPROVAL;

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const existingRutUser = await this.prisma.user.findUnique({
      where: { rut: normalizedRut },
      select: { id: true },
    });

    if (existingRutUser) {
      throw new ConflictException('El RUT ya está registrado');
    }

    if (normalizedPhone) {
      const existingPhoneUser = await this.prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true },
      });

      if (existingPhoneUser) {
        throw new ConflictException('El número de teléfono ya está registrado');
      }
    }

    if (data.occupationId) {
      const occupationDelegate = this.getOccupationDelegate();
      const occupationId = Number(data.occupationId);
      const occupation = await occupationDelegate.findUnique({
        where: { id: occupationId },
        select: { id: true, name: true },
      });

      if (!occupation) {
        throw new NotFoundException('Ocupación no encontrada');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...data,
          email: normalizedEmail,
          rut: normalizedRut,
          phone: normalizedPhone,
          role,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          rut: true,
          name: true,
          phone: true,
          role: true,
          occupationId: true,
        },
      });

      // No devolver token, solo usuario
      return { user };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const rawTarget = error.meta?.target;
        const target = Array.isArray(rawTarget)
          ? rawTarget.join(',')
          : typeof rawTarget === 'string'
            ? rawTarget
            : '';

        if (target.includes('phone')) {
          throw new ConflictException(
            'El número de teléfono ya está registrado',
          );
        }

        if (target.includes('email')) {
          throw new ConflictException('El email ya está registrado');
        }

        if (target.includes('rut')) {
          throw new ConflictException('El RUT ya está registrado');
        }

        throw new ConflictException(
          'Ya existe un usuario con los datos ingresados',
        );
      }

      throw error;
    }
  }

  async sendVerificationCode({ email }: { email: string }) {
    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttl = Number(process.env.VERIFICATION_CODE_TTL ?? 600);
    if (!email) {
      throw new ConflictException(
        'Debe enviar un email para verificación por correo.',
      );
    }

    // Validar que el usuario exista
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.isVerified) {
      throw new ConflictException('El usuario ya se encuentra verificado');
    }

    await this.enforceVerificationRateLimit(email, 'send-code');

    const key = `verify:email:${email}`;
    await this.mailService.sendVerificationCode(email, code);

    // Guardar código en Redis por el tiempo configurado
    await this.redisService.set(key, code, ttl);
    return { message: 'Código enviado por email' };
  }

  async verifyCode({ email, code }: { email: string; code: string }) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.isVerified) {
      throw new ConflictException('El usuario ya se encuentra verificado');
    }

    const key = `verify:email:${email}`;
    const stored = await this.redisService.get(key);
    if (!stored || stored !== code) {
      throw new UnauthorizedException(
        'Credenciales incorrectas o código expirado',
      );
    }

    // Actualizar el usuario como verificado en la base de datos
    await this.prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    // Eliminar el código para que no se reutilice
    await this.redisService.del(key);
    return { message: 'Verificación exitosa' };
  }

  async getVerificationStatus(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true, isVerified: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateVerificationEmail({
    oldEmail,
    newEmail,
  }: UpdateVerificationEmailDto) {
    if (oldEmail === newEmail) {
      throw new ConflictException(
        'El nuevo email debe ser diferente al actual',
      );
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { email: oldEmail },
      select: { id: true, isVerified: true },
    });

    if (!currentUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (currentUser.isVerified) {
      throw new ConflictException(
        'El usuario ya se encuentra verificado y no puede cambiar este correo por este flujo',
      );
    }

    const newEmailOwner = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    if (newEmailOwner) {
      throw new ConflictException('El nuevo email ya está registrado');
    }

    await this.enforceVerificationRateLimit(oldEmail, 'update-email');

    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: { email: newEmail, isVerified: false },
    });

    const oldKey = `verify:email:${oldEmail}`;
    await this.redisService.del(oldKey);

    await this.sendVerificationCode({ email: newEmail });

    return {
      message: 'Correo de verificación actualizado y código reenviado',
      email: newEmail,
    };
  }

  private async enforceVerificationRateLimit(
    email: string,
    action: 'send-code' | 'update-email',
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const key = `rate-limit:verification:${action}:${normalizedEmail}`;
    const isLimited = await this.redisService.exists(key);

    if (isLimited) {
      throw new HttpException(
        `Demasiadas solicitudes. Intente nuevamente en ${this.verificationRateLimitSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(key, '1', this.verificationRateLimitSeconds);
  }

  async login({ email, password }: LoginDto) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        rut: true,
        name: true,
        role: true,
        managedById: true,
        managedByUser: {
          select: { role: true },
        },
        isVerified: true,
        password: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    // Verificar si está verificado en la base de datos
    if (!user.isVerified) {
      throw new UnauthorizedException('Cuenta no verificada');
    }

    if (user.role === UserRole.PENDING_APPROVAL) {
      throw new UnauthorizedException(
        'Cuenta pendiente de aprobación por un administrador',
      );
    }
    const payload = { sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        rut: user.rut,
        name: user.name,
        role: user.role,
        managedById: user.managedById,
        managedByRole: user.managedByUser?.role ?? null,
      },
    };
  }

  async getCurrentUser(userId: number): Promise<CurrentUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        rut: true,
        name: true,
        role: true,
        managedById: true,
        managedByUser: {
          select: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      rut: user.rut,
      name: user.name,
      role: user.role,
      managedById: user.managedById,
      managedByRole: user.managedByUser?.role ?? null,
    };
  }

  async logout(authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');

    const decoded: unknown = this.jwtService.decode(token);
    if (!this.hasExpClaim(decoded)) {
      throw new UnauthorizedException('Token inválido');
    }
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await this.redisService.set(`blacklist:${token}`, 'true', ttl);
    }

    return { message: 'Logout exitoso' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    await this.enforceForgotPasswordRateLimit(email);

    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true },
    });

    // Siempre responder igual para no revelar si el email existe
    if (!user) {
      return {
        message:
          'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
      };
    }

    const token = randomUUID();
    const ttl = 3600; // 1 hora
    const tokenHash = this.hashResetToken(token);
    await this.redisService.set(
      `reset-password:${tokenHash}`,
      String(user.id),
      ttl,
    );

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/restablecer-contrasena?token=${token}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);

    return {
      message:
        'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashResetToken(token);
    const userId = await this.redisService.get(`reset-password:${tokenHash}`);
    if (!userId) {
      throw new UnauthorizedException(
        'El enlace de restablecimiento es inválido o ha expirado.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: Number(userId) },
      data: { password: hashedPassword },
    });

    await this.redisService.del(`reset-password:${tokenHash}`);
    await this.markUserTokensAsInvalidBefore(Number(userId));
    return { message: 'Contraseña actualizada correctamente.' };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  private async enforceForgotPasswordRateLimit(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const key = `rate-limit:forgot-password:${normalizedEmail}`;
    const isLimited = await this.redisService.exists(key);

    if (isLimited) {
      throw new HttpException(
        `Demasiadas solicitudes. Intente nuevamente en ${this.verificationRateLimitSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(key, '1', this.verificationRateLimitSeconds);
  }

  private async markUserTokensAsInvalidBefore(userId: number) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const jwtMaxLifetimeSeconds = 86400; // matches JWT expiresIn: '1d'
    await this.redisService.set(
      `auth:password-reset-after:${userId}`,
      String(nowInSeconds),
      jwtMaxLifetimeSeconds,
    );
  }

  private hasExpClaim(payload: unknown): payload is JwtPayloadWithExp {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    return (
      'exp' in payload &&
      typeof (payload as Record<string, unknown>).exp === 'number'
    );
  }
}
