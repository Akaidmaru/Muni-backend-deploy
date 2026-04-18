import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDailyMaintenanceRecordDto,
  UpdateDailyMaintenanceRecordDto,
} from './dto';

@Injectable()
export class DailyMaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

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
  async create(dto: CreateDailyMaintenanceRecordDto): Promise<{
    id: number;
    truckId: number;
    driverId: number;
    inspectionDate: Date;
    currentMileage: number;
  }> {
    const { startOfDay, endOfDay } = this.getUtcDayRange(dto.inspectionDate);

    // Verificar que el truck existe
    const truck = await this.prisma.truck.findUnique({
      where: { id: dto.truckId },
    });
    if (!truck) {
      throw new NotFoundException(`Truck con ID ${dto.truckId} no encontrado`);
    }

    // Verificar que el driver (usuario) existe
    const driver = await this.prisma.user.findUnique({
      where: { id: dto.driverId },
    });
    if (!driver) {
      throw new NotFoundException(
        `Driver con ID ${dto.driverId} no encontrado`,
      );
    }

    // Verificar que no exista ya un registro para este truck/driver/día
    const existingRecord = await this.prisma.dailyMaintenanceRecord.findFirst(
      {
        where: {
          driverId: dto.driverId,
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
        `Ya existe un registro de mantenimiento para este vehículo y conductor en esta fecha`,
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
      };
    });
  }

  /**
   * Obtener todos los registros de mantenimiento
   */
  async findAll() {
    return await this.prisma.dailyMaintenanceRecord.findMany({
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
  async findOne(id: number) {
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
  async findByTruckAndDate(truckId: number, inspectionDate: Date) {
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
  async findByDriverAndDate(driverId: number, inspectionDate: Date) {
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
    driverId: number,
    truckId: number,
    inspectionDate: Date,
  ) {
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
  async findByTruck(truckId: number) {
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
  async update(id: number, dto: UpdateDailyMaintenanceRecordDto) {
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

    // Filtrar propiedades undefined y convertir currentMileage a número
    const cleanData = Object.fromEntries(
      Object.entries(recordData)
        .filter(([, value]) => value !== undefined)
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
  async getTruckMileageSuggestion(truckId: number) {
    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: { mileage: true },
    });

    if (!truck) {
      throw new NotFoundException(`Truck con ID ${truckId} no encontrado`);
    }

    return { suggestedMileage: truck.mileage };
  }

  /**
   * Obtener mileage actual sugerido para un truck por patente
   */
  async getTruckMileageSuggestionByPlate(plate: string) {
    const truck = await this.prisma.truck.findUnique({
      where: { plate },
      select: { id: true, mileage: true },
    });

    if (!truck) {
      throw new NotFoundException(`Truck con patente ${plate} no encontrado`);
    }

    return {
      truckId: truck.id,
      suggestedMileage: truck.mileage,
    };
  }
}
