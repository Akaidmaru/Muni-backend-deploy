import {
  ConflictException,
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
      select: { role: true },
    });
    if (requester?.role === UserRole.ADMIN) return undefined;
    return requesterId;
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

  async findOne(id: number): Promise<EmployeeResponse> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async remove(id: number): Promise<void> {
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

  async update(id: number, dto: UpdateEmployeeDto): Promise<EmployeeResponse> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.name) {
      const normalizedName = dto.name.trim();
      const existing = await this.prisma.employee.findFirst({
        where: {
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
