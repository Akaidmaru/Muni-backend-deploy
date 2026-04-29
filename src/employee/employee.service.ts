import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UserRole } from '@prisma/client';

export type EmployeeResponse = {
  id: number;
  name: string;
  active: boolean;
  createdAt: Date;
};

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  private async getManagedById(requesterId: number): Promise<number | undefined> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });
    if (requester?.role === UserRole.ADMIN) return undefined;
    if (requester?.role === UserRole.DIRECTION) return requesterId;
    if (requester?.managedById) return requester.managedById;
    return requesterId;
  }

  private async assertEmployeeAccess(requesterId: number, id: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, managedById: true },
    });

    if (!employee) throw new NotFoundException('Employee not found');
    if (requester.role === UserRole.ADMIN) return employee;

    const allowedManagedById =
      requester.role === UserRole.DIRECTION ? requesterId : requester.managedById;

    if (employee.managedById !== allowedManagedById) {
      throw new ForbiddenException('No tienes permiso para acceder a este funcionario');
    }

    return employee;
  }

  async findActive(requesterId: number): Promise<EmployeeResponse[]> {
    const managedById = await this.getManagedById(requesterId);
    return this.prisma.employee.findMany({
      where: { active: true, managedById },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(requesterId: number): Promise<EmployeeResponse[]> {
    const managedById = await this.getManagedById(requesterId);
    return this.prisma.employee.findMany({
      where: { managedById },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async create(requesterId: number, dto: CreateEmployeeDto): Promise<EmployeeResponse> {
    const managedById = await this.getManagedById(requesterId);
    const storedManagedById = managedById ?? null;
    const normalizedName = dto.name.trim();

    const existing = await this.prisma.employee.findFirst({
      where: {
        managedById: storedManagedById,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
      select: { id: true, active: true },
    });

    if (existing) {
      if (!existing.active) {
        return this.prisma.employee.update({
          where: { id: existing.id },
          data: { active: true },
        });
      }

      throw new ConflictException('Employee already exists');
    }

    return this.prisma.employee.create({
      data: { name: normalizedName, active: true, managedById: storedManagedById },
    });
  }

  async findOne(id: number, requesterId?: number): Promise<EmployeeResponse> {
    if (requesterId !== undefined) {
      await this.assertEmployeeAccess(requesterId, id);
    }

    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async remove(requesterId: number, id: number): Promise<void> {
    await this.assertEmployeeAccess(requesterId, id);

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: { tripHistories: true } } },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    if (employee._count.tripHistories > 0) {
      throw new ConflictException(
        'Cannot delete employee with associated trip histories. Deactivate it instead.',
      );
    }

    await this.prisma.employee.delete({ where: { id } });
  }

  async update(
    requesterId: number,
    id: number,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponse> {
    const employee = await this.assertEmployeeAccess(requesterId, id);

    if (dto.name) {
      const normalizedName = dto.name.trim();
      const existing = await this.prisma.employee.findFirst({
        where: {
          managedById: employee.managedById,
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
          NOT: { id },
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('Employee already exists');
      }

      dto.name = normalizedName;
    }

    return this.prisma.employee.update({
      where: { id },
      data: dto,
    });
  }
}
