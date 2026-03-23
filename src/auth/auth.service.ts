import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user-dto';
import { LoginDto } from './dto/login-dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../common/mail.service';

interface JwtPayloadWithExp {
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private mailService: MailService,
  ) {}

  async register(data: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });

    // No devolver token, solo usuario
    return { user };
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

    const key = `verify:email:${email}`;
    await this.mailService.sendVerificationCode(email, code);

    // Guardar código en Redis por el tiempo configurado
    await this.redisService.set(key, code, ttl);
    return { message: 'Código enviado por email' };
  }

  async verifyCode({ email, code }: { email: string; code: string }) {
    const key = `verify:email:${email}`;
    const stored = await this.redisService.get(key);
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Código incorrecto o expirado');
    }

    // Actualizar el usuario como verificado en la base de datos
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    // Eliminar el código para que no se reutilice
    await this.redisService.del(key);
    return { message: 'Verificación exitosa' };
  }

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      omit: { password: false },
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
    const payload = { sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
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
