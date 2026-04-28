import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DailyMaintenanceRecordStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDailyMaintenanceRecordDto,
  UpdateDailyMaintenanceRecordDto,
} from './dto';

@Injectable()
export class DailyMaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

  private async getManagedById(requesterId: number): Promise<number | undefined> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    if (requester?.role === UserRole.ADMIN) return undefined;
    return requesterId;
  }

  private async getRequesterScope(requesterId: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado');
    }

    return {
      role: requester.role,
      managedById:
        requester.role === UserRole.ADMIN
          ? undefined
          : requester.role === UserRole.DIRECTION
            ? requesterId
            : requester.managedById,
    };
  }

  private async assertTruckAccess(requesterId: number, truckId: number) {
    const scope = await this.getRequesterScope(requesterId);
    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: { id: true, mileage: true, managedById: true },
    });

    if (!truck) {
      throw new NotFoundException(`Truck con ID ${truckId} no encontrado`);
    }

    if (scope.managedById !== undefined && truck.managedById !== scope.managedById) {
      throw new ForbiddenException('No tienes permiso para acceder a este vehículo');
    }

    return truck;
  }

  private async assertDriverAccess(requesterId: number, driverId: number) {
    const scope = await this.getRequesterScope(requesterId);
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, managedById: true },
    });

    if (!driver) {
      throw new NotFoundException(`Driver con ID ${driverId} no encontrado`);
    }

    if (
      scope.role !== UserRole.ADMIN &&
      scope.role !== UserRole.DIRECTION &&
      driverId !== requesterId
    ) {
      throw new ForbiddenException('No tienes permiso para usar este conductor');
    }

    if (scope.managedById !== undefined && driver.managedById !== scope.managedById) {
      throw new ForbiddenException('No tienes permiso para usar este conductor');
    }

    return driver;
  }

  private async assertRecordAccess(requesterId: number, recordId: number) {
    const scope = await this.getRequesterScope(requesterId);
    const record = await this.prisma.dailyMaintenanceRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        driverId: true,
        truck: { select: { managedById: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Registro de mantenimiento ID ${recordId} no encontrado`,
      );
    }

    if (scope.role === UserRole.ADMIN) return record;
    if (scope.role !== UserRole.DIRECTION && record.driverId !== requesterId) {
      throw new ForbiddenException('No tienes permiso para acceder a este registro');
    }
    if (scope.managedById !== undefined && record.truck.managedById !== scope.managedById) {
      throw new ForbiddenException('No tienes permiso para acceder a este registro');
    }

    return record;
  }

  private getUtcDayRange(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  /**
   * Crear nuevo registro de mantenimiento.
   * Si currentMileage difiere de truck.mileage, actualiza el truck.
   */
  async create(requesterId: number, dto: CreateDailyMaintenanceRecordDto): Promise<{
    id: number;
    truckId: number;
    driverId: number;
    inspectionDate: Date;
    currentMileage: number;
    status: DailyMaintenanceRecordStatus;
  }> {
    const { startOfDay, endOfDay } = this.getUtcDayRange(dto.inspectionDate);

    // Verificar que el truck existe
    const truck = await this.assertTruckAccess(requesterId, dto.truckId);
    await this.assertDriverAccess(requesterId, dto.driverId);

    // Verificar que el driver (usuario) existe
    const driver = await this.prisma.user.findUnique({
      where: { id: dto.driverId },
    });
    if (!driver) {
      throw new NotFoundException(
        `Driver con ID ${dto.driverId} no encontrado`,
      );
    }

    // Verificar que no exista ya un registro para este vehículo en el día
    const existingRecord = await this.prisma.dailyMaintenanceRecord.findFirst(
      {
        where: {
          truckId: dto.truckId,
          inspectionDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
    );

    if (existingRecord) {
      throw new ConflictException(
        `Ya existe un registro de mantenimiento para este vehículo en esta fecha`,
      );
    }

    // Separar dailyMaintenanceItems del DTO
    const { dailyMaintenanceItems, ...recordData } = dto;

    // Si currentMileage es 0 (default), usar el del truck
    const currentMileage =
      recordData.currentMileage === 0
        ? truck.mileage
        : recordData.currentMileage;

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.dailyMaintenanceRecord.create({
        data: {
          ...recordData,
          currentMileage,
          status: DailyMaintenanceRecordStatus.PENDING,
          dailyMaintenanceItems: {
            create: dailyMaintenanceItems,
          },
        },
        include: {
          dailyMaintenanceItems: true,
        },
      });

      if (currentMileage !== truck.mileage) {
        await tx.truck.update({
          where: { id: dto.truckId },
          data: { mileage: currentMileage },
        });
      }

      return {
        id: record.id,
        truckId: record.truckId,
        driverId: record.driverId,
        inspectionDate: record.inspectionDate,
        currentMileage: record.currentMileage,
        status: record.status,
      };
    });
  }

  /**
   * Obtener todos los registros de mantenimiento
   */
  async findAll(requesterId: number) {
    const managedById = await this.getManagedById(requesterId);
    return await this.prisma.dailyMaintenanceRecord.findMany({
      where: managedById !== undefined ? { truck: { managedById } } : undefined,
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
      orderBy: {
        inspectionDate: 'desc',
      },
    });
  }

  /**
   * Obtener un registro por ID
   */
  async findOne(id: number, requesterId?: number) {
    if (requesterId !== undefined) {
      await this.assertRecordAccess(requesterId, id);
    }

    const record = await this.prisma.dailyMaintenanceRecord.findUnique({
      where: { id },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            mileage: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Registro de mantenimiento ID ${id} no encontrado`,
      );
    }

    return record;
  }

  /**
   * Obtener registros por truck e inspectionDate
   */
  async findByTruckAndDate(
    requesterId: number,
    truckId: number,
    inspectionDate: Date,
  ) {
    await this.assertTruckAccess(requesterId, truckId);
    const { startOfDay, endOfDay } = this.getUtcDayRange(inspectionDate);
    const records = await this.prisma.dailyMaintenanceRecord.findMany({
      where: {
        truckId,
        inspectionDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
    });

    return records;
  }

  /**
   * Obtener registro de mantenimiento por conductor y fecha
   */
  async findByDriverAndDate(
    requesterId: number,
    driverId: number,
    inspectionDate: Date,
  ) {
    await this.assertDriverAccess(requesterId, driverId);
    const { startOfDay, endOfDay } = this.getUtcDayRange(inspectionDate);

    return await this.prisma.dailyMaintenanceRecord.findFirst({
      where: {
        driverId,
        inspectionDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            mileage: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
    });
  }

  /**
   * Obtener registro de mantenimiento por conductor, vehículo y fecha
   */
  async findByDriverTruckAndDate(
    requesterId: number,
    driverId: number,
    truckId: number,
    inspectionDate: Date,
  ) {
    await this.assertTruckAccess(requesterId, truckId);
    await this.assertDriverAccess(requesterId, driverId);
    const { startOfDay, endOfDay } = this.getUtcDayRange(inspectionDate);

    return await this.prisma.dailyMaintenanceRecord.findFirst({
      where: {
        driverId,
        truckId,
        inspectionDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            mileage: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
    });
  }

  /**
   * Obtener registros por truck
   */
  async findByTruck(requesterId: number, truckId: number) {
    await this.assertTruckAccess(requesterId, truckId);

    return await this.prisma.dailyMaintenanceRecord.findMany({
      where: { truckId },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
      orderBy: {
        inspectionDate: 'desc',
      },
    });
  }

  /**
   * Actualizar un registro de mantenimiento
   */
  async update(requesterId: number, id: number, dto: UpdateDailyMaintenanceRecordDto) {
    await this.assertRecordAccess(requesterId, id);
    // Verificar que el registro existe
    const existing = await this.prisma.dailyMaintenanceRecord.findUnique({
      where: { id },
      include: { dailyMaintenanceItems: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de mantenimiento ID ${id} no encontrado`,
      );
    }

    // Separar dailyMaintenanceItems del DTO
    const { dailyMaintenanceItems, ...recordData } = dto;

    // Filtrar propiedades undefined, evitar cambios directos de status
    // y convertir currentMileage a número
    const cleanData = Object.fromEntries(
      Object.entries(recordData)
        .filter(([key, value]) => key !== 'status' && value !== undefined)
        .map(([key, value]) => {
          if (key === 'currentMileage' && value !== undefined) {
            return [key, Number(value)];
          }
          return [key, value];
        }),
    );

    const updateData = cleanData as Prisma.DailyMaintenanceRecordUpdateInput;

    return this.prisma.$transaction(async (tx) => {
      if (dailyMaintenanceItems !== undefined && Array.isArray(dailyMaintenanceItems)) {
        await tx.dailyMaintenanceItem.deleteMany({ where: { recordId: id } });
        updateData.dailyMaintenanceItems = { create: dailyMaintenanceItems };
      }

      const updated = await tx.dailyMaintenanceRecord.update({
        where: { id },
        data: updateData,
        include: {
          truck: {
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
              year: true,
              seatCount: true,
              technicalReviewExpiresAt: true,
              circulationPermitExpiresAt: true,
              insuranceExpiresAt: true,
              emissionsExpiresAt: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          dailyMaintenanceItems: true,
        },
      });

      if (cleanData.currentMileage !== undefined) {
        const truck = await tx.truck.findUnique({
          where: { id: existing.truckId },
        });
        if (truck && Number(cleanData.currentMileage) !== truck.mileage) {
          await tx.truck.update({
            where: { id: existing.truckId },
            data: { mileage: Number(cleanData.currentMileage) },
          });
        }
      }

      return updated;
    });
  }

  async updateStatusAdmin(
    requesterId: number,
    id: number,
    status: DailyMaintenanceRecordStatus,
  ) {
    await this.assertRecordAccess(requesterId, id);

    return await this.prisma.dailyMaintenanceRecord.update({
      where: { id },
      data: { status },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
            seatCount: true,
            technicalReviewExpiresAt: true,
            circulationPermitExpiresAt: true,
            insuranceExpiresAt: true,
            emissionsExpiresAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyMaintenanceItems: true,
      },
    });
  }

  /**
   * Eliminar un registro de mantenimiento (cascade elimina items)
   */
  async remove(id: number) {
    const existing = await this.prisma.dailyMaintenanceRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de mantenimiento ID ${id} no encontrado`,
      );
    }

    return await this.prisma.dailyMaintenanceRecord.delete({
      where: { id },
    });
  }

  /**
   * Obtener mileage actual sugerido para un truck
   */
  async getTruckMileageSuggestion(requesterId: number, truckId: number) {
    const truck = await this.assertTruckAccess(requesterId, truckId);

    return { suggestedMileage: truck.mileage };
  }

  /**
   * Obtener mileage actual sugerido para un truck por patente
   */
  async getTruckMileageSuggestionByPlate(requesterId: number, plate: string) {
    const scope = await this.getRequesterScope(requesterId);
    const truck = await this.prisma.truck.findUnique({
      where: { plate },
      select: {
        id: true,
        plate: true,
        mileage: true,
        technicalReviewExpiresAt: true,
        circulationPermitExpiresAt: true,
        insuranceExpiresAt: true,
        emissionsExpiresAt: true,
        managedById: true,
      },
    });

    if (!truck) {
      throw new NotFoundException(`Truck con patente ${plate} no encontrado`);
    }

    if (scope.managedById !== undefined && truck.managedById !== scope.managedById) {
      throw new ForbiddenException('No tienes permiso para acceder a este vehículo');
    }

    return {
      truckId: truck.id,
      suggestedMileage: truck.mileage,
      truck,
    };
  }
}
