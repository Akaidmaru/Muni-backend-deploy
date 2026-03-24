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

interface OccupationListItem {
  id: number;
  name: string;
}

interface OccupationIdOnly {
  id: number;
}

interface CurrentUserResponse {
  id: number;
  email: string;
  name: string | null;
  role: string;
}

interface OccupationDelegate {
  findMany(args: {
    orderBy: { name: 'asc' | 'desc' };
    select: { id: true; name: true };
  }): Promise<OccupationListItem[]>;
  findUnique(args: {
    where: { id: number };
    select: { id: true };
  }): Promise<OccupationIdOnly | null>;
}

@Injectable()
export class AuthService {
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
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    if (data.occupationId) {
      const occupationDelegate = this.getOccupationDelegate();
      const occupationId = Number(data.occupationId);
      const occupation = await occupationDelegate.findUnique({
        where: { id: occupationId },
        select: { id: true },
      });

      if (!occupation) {
        throw new NotFoundException('Ocupación no encontrada');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        occupationId: true,
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
    if (user.isVerified) {
      throw new ConflictException('El usuario ya se encuentra verificado');
    }

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

  async getCurrentUser(userId: number): Promise<CurrentUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user as CurrentUserResponse;
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
