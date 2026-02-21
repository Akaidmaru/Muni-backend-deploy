import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user-dto';
import { UpdateUserDto } from './dto/update-user-dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import * as bcrypt from 'bcrypt';
import { UserUpdateInput } from '../../generated/prisma/models/User';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });
  }

  async adminCreate(dto: AdminCreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany();
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

  async getTrucksOfUser(userId: number) {
    const assignments = await this.prisma.truckAssignment.findMany({
      where: { userId },
      include: { truck: true },
    });
    return assignments.map((a) => a.truck);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }


  async findByVerificationStatus(status: string) {
    const { BadRequestException } = await import('@nestjs/common');
    if (
      typeof status !== 'string' ||
      (status !== 'true' && status !== 'false')
    ) {
      throw new BadRequestException(
        "El parámetro 'status' es requerido y debe ser 'true' o 'false'.",
      );
    }
    const isVerified = status === 'true';
    return this.prisma.user.findMany({
      where: { isVerified },
    });
  }


  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id); // Verifica que existe

    const data: UserUpdateInput = { ...dto };

    // Si se actualiza el password, lo hasheamos
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Verifica que existe

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async adminUpdateUser(id: number, dto: AdminUpdateUserDto) {
    const user = await this.findOne(id);

    // No permitir editar usuarios ADMIN
    if (user.role === 'ADMIN') {
      throw new ForbiddenException(
        'No se puede editar a un usuario administrador',
      );
    }

    const data: UserUpdateInput = { ...dto };

    // Si se actualiza el password, lo hasheamos
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
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

    return { message: 'Contraseña actualizada correctamente' };
  }
}
