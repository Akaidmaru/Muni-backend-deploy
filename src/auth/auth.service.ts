import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user-dto';
import { LoginDto } from './dto/login-dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../common/mail.service';
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

  async sendVerificationCode({
    email,
    channel,
  }: {
    email?: string;
    phone?: string;
    channel: 'email' | 'sms';
  }) {
    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    let key = '';
    const ttl = Number(process.env.VERIFICATION_CODE_TTL ?? 600);
    if (channel === 'email' && email) {
      key = `verify:email:${email}`;
      await this.mailService.sendVerificationCode(email, code);
    } else {
      throw new ConflictException('Solo se permite verificación por email.');
    }
    // Guardar código en Redis por el tiempo configurado
    await this.redisService.set(key, code, ttl);
    return { message: `Código enviado por ${channel}` };
  }

  async verifyCode({
    email,
    phone,
    code,
  }: {
    email?: string;
    phone?: string;
    code: string;
  }) {
    let key = '';
    if (email) {
      key = `verify:email:${email}`;
    } else if (phone) {
      key = `verify:sms:${phone}`;
    } else {
      throw new ConflictException('Destino inválido');
    }
    const stored = await this.redisService.get(key);
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Código incorrecto o expirado');
    }
    // Actualizar el usuario como verificado en la base de datos
    if (email) {
      await this.prisma.user.update({
        where: { email },
        data: { isVerified: true },
      });
    }
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const decoded = this.jwtService.decode(token);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!decoded || typeof decoded.exp !== 'number') {
      throw new UnauthorizedException('Token inválido');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const ttl = (decoded.exp as number) - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await this.redisService.set(`blacklist:${token}`, 'true', ttl);
    }

    return { message: 'Logout exitoso' };
  }
}
