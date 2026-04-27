import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { Prisma, TruckStatus } from '@prisma/client';
import { UserRole } from '@prisma/client';

export interface UserListItem {
  id: number;
  email: string;
  rut: string;
  phone: string | null;
  name: string | null;
  createdAt: Date;
  role: UserRole;
  occupationId: number | null;
  isVerified: boolean;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private async getManagedById(requesterId: number): Promise<number | undefined> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (requester?.role === UserRole.ADMIN) return undefined;
    return requesterId;
  }

  async findByRoles(
    requesterId: number,
    roles?: UserRole[],
  ): Promise<UserListItem[]> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado');
    }

    const allRoles = Object.values(UserRole);
    const requestedRoles = roles && roles.length > 0 ? roles : allRoles;

    if (
      requester.role !== UserRole.ADMIN &&
      requestedRoles.includes(UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Solo un usuario ADMIN puede listar usuarios con rol ADMIN',
      );
    }

    const allowedRoles =
      requester.role === UserRole.ADMIN
        ? requestedRoles
        : requestedRoles.filter((role) => role !== UserRole.ADMIN);

    const managedById = requester.role === UserRole.ADMIN ? undefined : requesterId;

    return this.prisma.user.findMany({
      where: {
        managedById,
        role: { in: allowedRoles },
      },
      select: {
        id: true,
        email: true,
        rut: true,
        phone: true,
        name: true,
        createdAt: true,
        role: true,
        occupationId: true,
        isVerified: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedRut = dto.rut.trim().toUpperCase();
    const normalizedPhone = dto.phone?.trim() || undefined;
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          ...dto,
          email: normalizedEmail,
          rut: normalizedRut,
          phone: normalizedPhone,
          password: hashedPassword,
        },
      });
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

        if (target.includes('email')) {
          throw new ConflictException('El email ya está registrado');
        }

        if (target.includes('rut')) {
          throw new ConflictException('El RUT ya está registrado');
        }

        if (target.includes('phone')) {
          throw new ConflictException(
            'El número de teléfono ya está registrado',
          );
        }
      }

      throw error;
    }
  }

  async adminCreate(requesterId: number, dto: AdminCreateUserDto) {
    const managedById = (await this.getManagedById(requesterId)) ?? null;
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const normalizedRut = dto.rut.trim().toUpperCase();

    const existingRutUser = await this.prisma.user.findUnique({
      where: { rut: normalizedRut },
      select: { id: true },
    });

    if (existingRutUser) {
      throw new ConflictException('El RUT ya está registrado');
    }

    const normalizedPhone = dto.phone?.trim() || undefined;

    if (normalizedPhone) {
      const existingPhoneUser = await this.prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: { id: true },
      });

      if (existingPhoneUser) {
        throw new ConflictException('El número de teléfono ya está registrado');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        ...dto,
        email: dto.email.trim().toLowerCase(),
        rut: normalizedRut,
        phone: normalizedPhone,
        password: hashedPassword,
        isVerified: true,
        managedById,
      },
    });
  }

  async findAll(requesterId: number, page = 1, pageSize = 50) {
    const managedById = await this.getManagedById(requesterId);
    const safePage = page > 0 ? page : 1;
    const safePageSize = Math.min(pageSize > 0 ? pageSize : 50, 200);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { managedById },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        orderBy: { id: 'asc' },
      }),
      this.prisma.user.count({ where: { managedById } }),
    ]);
    return { items, total, page: safePage, pageSize: safePageSize };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async getTrucksOfUser(userId: number, includeUnassignedFallback = false) {
    const assignments = await this.prisma.truckAssignment.findMany({
      where: {
        userId,
        truck: {
          status: TruckStatus.ACTIVE,
        },
      },
      include: { truck: true },
    });

    if (assignments.length > 0 || !includeUnassignedFallback) {
      return assignments.map((a) => a.truck);
    }

    return this.prisma.truck.findMany({
      where: {
        status: TruckStatus.ACTIVE,
        users: {
          none: {},
        },
      },
      orderBy: {
        plate: 'asc',
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByVerificationStatus(requesterId: number, status: string) {
    if (
      typeof status !== 'string' ||
      (status !== 'true' && status !== 'false')
    ) {
      throw new BadRequestException(
        "El parámetro 'status' es requerido y debe ser 'true' o 'false'.",
      );
    }
    const managedById = await this.getManagedById(requesterId);
    const isVerified = status === 'true';
    return this.prisma.user.findMany({
      where: { isVerified, managedById },
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id); // Verifica que existe

    const data: Prisma.UserUpdateInput = { ...dto };

    // Si se actualiza el password, lo hasheamos
    if ('password' in dto && dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const user = await this.findOne(id);

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'No se puede eliminar a un usuario administrador',
      );
    }

    try {
      await this.prisma.user.delete({
        where: { id },
      });

      return { message: 'Usuario eliminado correctamente' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar el usuario porque tiene registros asociados',
        );
      }

      throw error;
    }
  }

  async adminUpdateUser(id: number, dto: AdminUpdateUserDto) {
    const user = await this.findOne(id);

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'No se puede editar a un usuario administrador',
      );
    }

    const data: Prisma.UserUpdateInput = { ...dto };
    const passwordChanged = 'password' in dto && !!dto.password;

    if (passwordChanged) {
      data.password = await bcrypt.hash(dto.password as string, 10);
    }

    await this.prisma.user.update({
      where: { id },
      data,
    });

    if (passwordChanged) {
      await this.markUserTokensAsInvalidBefore(id);
    }

    return { message: 'Usuario actualizado correctamente' };
  }

  async findWithTrucks(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        trucks: {
          include: {
            truck: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: { password: false },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    await this.markUserTokensAsInvalidBefore(userId);

    return { message: 'Contraseña actualizada correctamente' };
  }

  async adminResetPassword(id: number, newPassword: string) {
    await this.findOne(id);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    await this.markUserTokensAsInvalidBefore(id);

    return { message: 'Contraseña actualizada por el administrador' };
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
}
