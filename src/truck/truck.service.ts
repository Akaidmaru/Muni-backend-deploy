import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { Prisma, PlateChangeReason, TruckStatus, UserRole } from '@prisma/client';
import { RegisterPlateChangeDto } from './dto/register-plate-change.dto';

@Injectable()
export class TruckService {
  constructor(private prisma: PrismaService) {}

  private sanitizeTruckCreateInput(
    dto: CreateTruckDto,
  ): Prisma.TruckUncheckedCreateInput {
    const data: Prisma.TruckUncheckedCreateInput = {
      ...dto,
    };

    data.plate = dto.plate.trim().toUpperCase();
    data.model = dto.model.trim();

    if (typeof dto.brand === 'string') {
      data.brand = dto.brand.trim();
    }

    return data;
  }

  private sanitizeTruckUpdateInput(
    dto: UpdateTruckDto,
  ): Prisma.TruckUncheckedUpdateInput {
    const data: Prisma.TruckUncheckedUpdateInput = {
      ...dto,
    };

    if (typeof dto.plate === 'string') {
      data.plate = dto.plate.trim().toUpperCase();
    }

    if (typeof dto.model === 'string') {
      data.model = dto.model.trim();
    }

    if (typeof dto.brand === 'string') {
      data.brand = dto.brand.trim();
    }

    const dateFields: Array<
      'technicalReviewExpiresAt' | 'circulationPermitExpiresAt' | 'insuranceExpiresAt' | 'emissionsExpiresAt'
    > = [
      'technicalReviewExpiresAt',
      'circulationPermitExpiresAt',
      'insuranceExpiresAt',
      'emissionsExpiresAt',
    ];

    for (const field of dateFields) {
      if (dto[field] === null) {
        data[field] = null;
      }
    }

    return data;
  }

  async create(dto: CreateTruckDto) {
    const data = this.sanitizeTruckCreateInput(dto);

    try {
      return await this.prisma.truck.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('La patente ya está registrada');
      }

      throw error;
    }
  }

  findAll() {
    return this.prisma.truck.findMany({
      include: {
        users: {
          where: {
            user: {
              role: UserRole.DRIVER,
            },
          },
          select: {
            userId: true,
            truckId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async findUnassigned() {
    return this.prisma.truck.findMany({
      where: {
        users: {
          none: {
            user: {
              role: UserRole.DRIVER,
            },
          },
        },
      },
      select: {
        id: true,
        plate: true,
      },
    });
  }

  async findOne(id: number) {
    const truck = await this.prisma.truck.findUnique({
      where: { id },
      include: {
        users: {
          where: {
            user: {
              role: UserRole.DRIVER,
            },
          },
          select: {
            userId: true,
            truckId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!truck) {
      throw new NotFoundException(`Camión con ID ${id} no encontrado`);
    }

    return truck;
  }

  async update(id: number, dto: UpdateTruckDto) {
    await this.findOne(id);

    const data = this.sanitizeTruckUpdateInput(dto);

    try {
      return await this.prisma.truck.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('La patente ya está registrada');
      }

      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.prisma.truck.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar la patente porque tiene registros asociados',
        );
      }

      throw error;
    }
  }

  async assignUser(dto: AssignUserDto) {
    const [truck, user] = await Promise.all([
      this.prisma.truck.findUnique({ where: { id: dto.truckId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } }),
    ]);

    if (!truck) {
      throw new NotFoundException(`Camión con ID ${dto.truckId} no encontrado`);
    }

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${dto.userId} no encontrado`);
    }

    const existing = await this.prisma.truckAssignment.findUnique({
      where: { userId_truckId: { userId: dto.userId, truckId: dto.truckId } },
    });

    if (existing) {
      throw new BadRequestException('El usuario ya está asignado a este camión');
    }

    try {
      return await this.prisma.truckAssignment.create({
        data: {
          userId: dto.userId,
          truckId: dto.truckId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('El usuario ya está asignado a este camión');
      }
      throw error;
    }
  }

  async getUsersOfTruck(truckId: number) {
    const assignments = await this.prisma.truckAssignment.findMany({
      where: { truckId },
      include: { user: true },
    });
    return assignments.map((a) => a.user);
  }

  async registerPlateChange(userId: number, dto: RegisterPlateChangeDto) {
    return this.prisma.$transaction(async (tx) => {
      const truck = await tx.truck.findUnique({
        where: { id: dto.truckId },
        select: { id: true, status: true },
      });

      if (!truck) {
        throw new NotFoundException('Camión no encontrado');
      }

      const previousStatus = truck.status;
      const newStatus =
        dto.reason === PlateChangeReason.AVERIA
          ? TruckStatus.INACTIVE
          : previousStatus;

      if (newStatus !== previousStatus) {
        await tx.truck.update({
          where: { id: dto.truckId },
          data: { status: newStatus },
        });
      }

      const log = await tx.truckPlateChangeLog.create({
        data: {
          truckId: dto.truckId,
          changedByUserId: userId,
          reason: dto.reason,
          observations: dto.observations.trim(),
          previousStatus,
          newStatus,
        },
      });

      return {
        id: log.id,
        truckId: log.truckId,
        reason: log.reason,
        observations: log.observations,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        createdAt: log.createdAt,
      };
    });
  }

  async getOutOfServiceAlerts() {
    const logs = await this.prisma.truckPlateChangeLog.findMany({
      where: {
        reason: PlateChangeReason.AVERIA,
        newStatus: TruckStatus.INACTIVE,
        truck: {
          status: TruckStatus.INACTIVE,
        },
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
          },
        },
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const seenTruckIds = new Set<number>();
    const latestPerTruck = logs.filter((log) => {
      if (seenTruckIds.has(log.truckId)) {
        return false;
      }
      seenTruckIds.add(log.truckId);
      return true;
    });

    return latestPerTruck.map((log) => ({
      id: log.id,
      truckId: log.truckId,
      plate: log.truck.plate,
      driver:
        log.changedBy.name || log.changedBy.email || `Usuario ${log.changedBy.id}`,
      category: 'Avería',
      observation: log.observations,
      reportedAt: log.createdAt,
    }));
  }
}
