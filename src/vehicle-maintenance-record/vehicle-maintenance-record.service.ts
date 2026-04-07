import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVehicleMaintenanceRecordDto,
  UpdateVehicleMaintenanceRecordDto,
} from './dto';

@Injectable()
export class VehicleMaintenanceRecordService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear nuevo registro de mantenimiento.
   * Si currentMileage difiere de truck.mileage, actualiza el truck.
   */
  async create(dto: CreateVehicleMaintenanceRecordDto): Promise<{
    id: number;
    truckId: number;
    driverId: number;
    inspectionDate: Date;
    currentMileage: number;
  }> {
    const startOfDay = new Date(dto.inspectionDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dto.inspectionDate);
    endOfDay.setHours(23, 59, 59, 999);

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
    const existingRecord = await this.prisma.vehicleMaintenanceRecord.findFirst(
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

    // Separar maintenanceItems del DTO
    const { maintenanceItems, ...recordData } = dto;

    // Si currentMileage es 0 (default), usar el del truck
    const currentMileage =
      recordData.currentMileage === 0
        ? truck.mileage
        : recordData.currentMileage;

    // Crear el registro y los items en una transacción
    const record = await this.prisma.vehicleMaintenanceRecord.create({
      data: {
        ...recordData,
        currentMileage,
        maintenanceItems: {
          create: maintenanceItems,
        },
      },
      include: {
        maintenanceItems: true,
      },
    });

    // Si currentMileage difiere del mileage actual del truck, actualizar
    if (currentMileage !== truck.mileage) {
      await this.prisma.truck.update({
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
  }

  /**
   * Obtener todos los registros de mantenimiento
   */
  async findAll() {
    return await this.prisma.vehicleMaintenanceRecord.findMany({
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            model: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
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
    const record = await this.prisma.vehicleMaintenanceRecord.findUnique({
      where: { id },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            model: true,
            mileage: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
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
    const records = await this.prisma.vehicleMaintenanceRecord.findMany({
      where: {
        truckId,
        inspectionDate,
      },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            model: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
      },
    });

    return records;
  }

  /**
   * Obtener registro de mantenimiento por conductor y fecha
   */
  async findByDriverAndDate(driverId: number, inspectionDate: Date) {
    const startOfDay = new Date(inspectionDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(inspectionDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.prisma.vehicleMaintenanceRecord.findFirst({
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
            model: true,
            mileage: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
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
    const startOfDay = new Date(inspectionDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(inspectionDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.prisma.vehicleMaintenanceRecord.findFirst({
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
            model: true,
            mileage: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
      },
    });
  }

  /**
   * Obtener registros por truck
   */
  async findByTruck(truckId: number) {
    return await this.prisma.vehicleMaintenanceRecord.findMany({
      where: { truckId },
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            model: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
      },
      orderBy: {
        inspectionDate: 'desc',
      },
    });
  }

  /**
   * Actualizar un registro de mantenimiento
   */
  async update(id: number, dto: UpdateVehicleMaintenanceRecordDto) {
    // Verificar que el registro existe
    const existing = await this.prisma.vehicleMaintenanceRecord.findUnique({
      where: { id },
      include: { maintenanceItems: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de mantenimiento ID ${id} no encontrado`,
      );
    }

    const updated = await this.prisma.vehicleMaintenanceRecord.update({
      where: { id },
      data: dto,
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            model: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        maintenanceItems: true,
      },
    });

    // Si se actualizó currentMileage y difiere del truck actual, actualizar truck
    if (dto.currentMileage !== undefined) {
      const truck = await this.prisma.truck.findUnique({
        where: { id: existing.truckId },
      });
      if (truck && dto.currentMileage !== truck.mileage) {
        await this.prisma.truck.update({
          where: { id: existing.truckId },
          data: { mileage: dto.currentMileage },
        });
      }
    }

    return updated;
  }

  /**
   * Eliminar un registro de mantenimiento (cascade elimina items)
   */
  async remove(id: number) {
    const existing = await this.prisma.vehicleMaintenanceRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(
        `Registro de mantenimiento ID ${id} no encontrado`,
      );
    }

    return await this.prisma.vehicleMaintenanceRecord.delete({
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
