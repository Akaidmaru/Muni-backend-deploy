import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { PlateChangeReason, TruckStatus, UserRole } from '@prisma/client';
import { RegisterPlateChangeDto } from './dto/register-plate-change.dto';

@Injectable()
export class TruckService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateTruckDto) {
    return this.prisma.truck.create({ data: dto });
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

  findOne(id: number) {
    return this.prisma.truck.findUnique({
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
  }

  update(id: number, dto: UpdateTruckDto) {
    return this.prisma.truck.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.truck.delete({ where: { id } });
  }

  assignUser(dto: AssignUserDto) {
    return this.prisma.truckAssignment.create({
      data: {
        userId: dto.userId,
        truckId: dto.truckId,
      },
    });
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
