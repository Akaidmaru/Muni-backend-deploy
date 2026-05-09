import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, TripHistoryStatus, TruckStatus, UserRole } from '@prisma/client';
import { S3Service } from '../common/s3.service';
import { RedisService } from '../redis/redis.service';
import { DestinationService } from '../destination/destination.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleRoadsService } from '../route/googleRoads.service';
import { FinishTripDto } from './dto/finish-trip.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { CreateTripHistoryPointsDto } from './dto/create-trip-history-points.dto';
import { UpdateTripHistoryDto } from './dto/update-trip-history.dto';

type FindAllOptions = {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  name?: string;
  destination?: string;
  driver?: string;
  license?: string;
};

type PaginationData = {
  page: number;
  pageSize: number;
};

@Injectable()
export class TripHistoryService {
  private readonly logger = new Logger(TripHistoryService.name);
  private readonly signedUrlCacheTtl = 3000; // 50 min (S3 TTL es 60 min)

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly redisService: RedisService,
    private readonly googleRoadsService: GoogleRoadsService,
    private readonly destinationService: DestinationService,
  ) {}

  private async resolveDriverManagedById(
    driverId: number,
  ): Promise<{ managedById: number | null; managedByRole: UserRole | null }> {
    const driverUser = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: {
        managedById: true,
        role: true,
        managedByUser: {
          select: { role: true },
        },
      },
    });

    if (!driverUser) {
      throw new NotFoundException('Conductor no encontrado');
    }

    if (driverUser.role !== UserRole.DRIVER) {
      throw new ForbiddenException('El usuario no es un conductor');
    }

    return {
      managedById: driverUser.managedById ?? null,
      managedByRole: driverUser.managedByUser?.role ?? null,
    };
  }

  private async getCachedSignedUrl(key: string): Promise<string | null> {
    const cacheKey = `s3:signed-url:${key}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;
    const url = await this.s3Service.getSignedGetUrl(key).catch((err: unknown) => {
      this.logger.warn(`No se pudo generar URL firmada para ${key}: ${String(err)}`);
      return null;
    });
    if (url) await this.redisService.set(cacheKey, url, this.signedUrlCacheTtl);
    return url;
  }

  private async getCachedDataUrl(key: string): Promise<string | null> {
    const cacheKey = `s3:data-url:${key}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;
    const url = await this.s3Service.getObjectDataUrl(key).catch((err: unknown) => {
      this.logger.warn(`No se pudo generar data URL para ${key}: ${String(err)}`);
      return null;
    });
    if (url) await this.redisService.set(cacheKey, url, this.signedUrlCacheTtl);
    return url;
  }

  private parsePagination(options: FindAllOptions): PaginationData {
    const page =
      Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
    const pageSize =
      Number.isInteger(options.pageSize) && options.pageSize > 0
        ? Math.min(options.pageSize, 100)
        : 10;

    return { page, pageSize };
  }

  private buildFilters(
    options: FindAllOptions,
  ): Prisma.TripHistoryWhereInput[] {
    const whereAnd: Prisma.TripHistoryWhereInput[] = [];

    if (options.license) {
      whereAnd.push({
        truck: {
          plate: options.license,
        },
      });
    }

    if (options.name) {
      whereAnd.push({
        employee: {
          name: {
            contains: options.name,
            mode: 'insensitive',
          },
        },
      });
    }

    if (options.destination) {
      whereAnd.push({
        destination: {
          name: {
            contains: options.destination,
            mode: 'insensitive',
          },
        },
      });
    }

    if (options.driver) {
      whereAnd.push({
        driver: {
          name: {
            contains: options.driver,
            mode: 'insensitive',
          },
        },
      });
    }

    if (options.from || options.to) {
      const dateFilter: Prisma.DateTimeFilter = {};

      if (options.from) {
        const fromDate = new Date(`${options.from}T00:00:00.000Z`);
        if (!Number.isNaN(fromDate.getTime())) {
          dateFilter.gte = fromDate;
        }
      }

      if (options.to) {
        const toDate = new Date(`${options.to}T23:59:59.999Z`);
        if (!Number.isNaN(toDate.getTime())) {
          dateFilter.lte = toDate;
        }
      }

      if (Object.keys(dateFilter).length > 0) {
        whereAnd.push({ date: dateFilter });
      }
    }

    return whereAnd;
  }

  private parseDateOnly(dateStr: string): Date | null {
    const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }

    return parsed;
  }

  private getCurrentDateForTimeZone(timeZone?: string): Date {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(new Date());
      const year = parts.find((part) => part.type === 'year')?.value;
      const month = parts.find((part) => part.type === 'month')?.value;
      const day = parts.find((part) => part.type === 'day')?.value;

      if (year && month && day) {
        const parsed = this.parseDateOnly(`${year}-${month}-${day}`);
        if (parsed) return parsed;
      }
    } catch {
      // Si llega una zona inválida, caer al comportamiento por defecto.
    }

    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private getUtcDayRange(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  private resolveOperationalDate(
    clientDate?: string,
    clientTimeZone?: string,
  ): Date {
    if (clientDate) {
      const parsedClientDate = this.parseDateOnly(clientDate);
      if (parsedClientDate) {
        return parsedClientDate;
      }
    }

    return this.getCurrentDateForTimeZone(clientTimeZone);
  }

  private async findWithWhere(
    whereAnd: Prisma.TripHistoryWhereInput[],
    pagination: PaginationData,
  ) {
    const where: Prisma.TripHistoryWhereInput =
      whereAnd.length > 0 ? { AND: whereAnd } : {};

    const total = await this.prisma.tripHistory.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
    const safePage = Math.min(pagination.page, totalPages);

    const items = await this.prisma.tripHistory.findMany({
      where,
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
          },
        },
        destination: {
          select: {
            id: true,
            name: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      skip: (safePage - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });

    const mappedItems = await Promise.all(
      items.map(async (item) => {
        const [signatureUrl, signatureDataUrl] = item.signatureKey
          ? await Promise.all([
              this.getCachedSignedUrl(item.signatureKey),
              this.getCachedDataUrl(item.signatureKey),
            ])
          : [null, null];

        return {
          ...item,
          signatureUrl,
          signatureDataUrl,
        };
      }),
    );

    return {
      items: mappedItems,
      total,
      page: safePage,
      pageSize: pagination.pageSize,
      totalPages,
    };
  }

  private async assertAdminTripAccess(requesterId: number, tripHistoryId: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado');
    }

    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        signatureKey: true,
        truck: { select: { managedById: true } },
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (
      requester.role !== UserRole.ADMIN &&
      tripHistory.truck.managedById !== requesterId
    ) {
      throw new ForbiddenException('No tienes permiso para acceder a este viaje');
    }

    return tripHistory;
  }

  async findAll(requesterId: number, options: FindAllOptions) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    const pagination = this.parsePagination(options);
    const whereAnd = this.buildFilters(options);

    if (requester?.role !== UserRole.ADMIN) {
      whereAnd.push({ truck: { managedById: requesterId } });
    }

    return this.findWithWhere(whereAnd, pagination);
  }

  async findByUserAccess(userId: number, options: FindAllOptions) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const pagination = this.parsePagination(options);
    const whereAnd = this.buildFilters(options);

    if (requester.role !== UserRole.ADMIN) {
      whereAnd.push({ driverId: userId });
    }

    return this.findWithWhere(whereAnd, pagination);
  }

  async startTrip(userId: number, dto: StartTripDto, clientTimeZone?: string) {
    const driverScope = await this.resolveDriverManagedById(userId);
    const managerRole = driverScope.managedByRole;

    if (
      driverScope.managedById === null ||
      (managerRole !== UserRole.ADMIN && managerRole !== UserRole.DIRECTION)
    ) {
      throw new ForbiddenException(
        'La cuenta debe estar asociada a un usuario con rol ADMIN o DIRECTION para iniciar viajes.',
      );
    }

    const driverManagedById = driverScope.managedById;

    const truck = await this.prisma.truck.findFirst({
      where: {
        plate: dto.plate,
        status: TruckStatus.ACTIVE,
      },
      select: {
        id: true,
        mileage: true,
      },
    });

    if (!truck) {
      throw new NotFoundException('La patente seleccionada no está activa');
    }

    const operationalDate = this.resolveOperationalDate(
      dto.clientDate,
      clientTimeZone,
    );
    const { startOfDay, endOfDay } = this.getUtcDayRange(operationalDate);

    const maintenanceRecord = await this.prisma.dailyMaintenanceRecord.findFirst(
      {
        where: {
          truckId: truck.id,
          inspectionDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        select: { id: true },
      },
    );

    if (!maintenanceRecord) {
      throw new BadRequestException(
        'Debe completar la encuesta diaria del vehículo antes de iniciar el primer viaje.',
      );
    }

    const customDestinationName = dto.customDestination?.trim();
    let destination: { id: number; name: string } | null = null;

    if (customDestinationName) {
      destination = await this.destinationService.findOrCreateActiveByName(
        customDestinationName,
        driverManagedById,
      );
    } else if (dto.destinationId) {
      const selectedDestination = await this.prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true, name: true, active: true, managedById: true },
      });

      if (!selectedDestination || !selectedDestination.active) {
        throw new NotFoundException('Destino no encontrado');
      }

      if (selectedDestination.managedById !== driverManagedById) {
        throw new ForbiddenException(
          'El destino no pertenece al administrador del conductor',
        );
      }

      destination = {
        id: selectedDestination.id,
        name: selectedDestination.name,
      };
    }

    if (!destination) {
      throw new NotFoundException('Destino no encontrado');
    }

    const customEmployeeName = dto.customEmployee?.trim();
    let employee: { id: number; name: string } | null = null;

    if (customEmployeeName) {
      const existingEmployee = await this.prisma.employee.findFirst({
        where: {
          managedById: driverManagedById,
          name: {
            equals: customEmployeeName,
            mode: 'insensitive',
          },
        },
        select: { id: true, name: true, active: true },
      });

      if (existingEmployee) {
        if (!existingEmployee.active) {
          const reactivatedEmployee = await this.prisma.employee.update({
            where: { id: existingEmployee.id },
            data: { active: true },
            select: { id: true, name: true },
          });
          employee = reactivatedEmployee;
        } else {
          employee = { id: existingEmployee.id, name: existingEmployee.name };
        }
      } else {
        employee = await this.prisma.employee.create({
          data: {
            name: customEmployeeName,
            active: true,
            managedById: driverManagedById,
          },
          select: { id: true, name: true },
        });
      }
    } else if (dto.employeeId) {
      const selectedEmployee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { id: true, name: true, active: true, managedById: true },
      });

      if (!selectedEmployee || !selectedEmployee.active) {
        throw new NotFoundException('Funcionario no encontrado');
      }

      if (selectedEmployee.managedById !== driverManagedById) {
        throw new ForbiddenException(
          'El funcionario no pertenece al administrador del conductor',
        );
      }

      employee = { id: selectedEmployee.id, name: selectedEmployee.name };
    }

    if (!employee) {
      throw new BadRequestException(
        'Debes seleccionar o ingresar un funcionario',
      );
    }

    const mileageValue: unknown = truck.mileage;
    if (typeof mileageValue !== 'number' || Number.isNaN(mileageValue)) {
      throw new BadRequestException('El kilometraje del camión es inválido');
    }

    const startKm = mileageValue;

    return this.prisma.tripHistory.create({
      data: {
        date: operationalDate,
        startTime: dto.startTime,
        endTime: null,
        observations: dto.observations || null,
        status: TripHistoryStatus.DRIVER_FILLING,
        startKm,
        endKm: null,
        truckId: truck.id,
        destinationId: destination.id,
        employeeId: employee.id,
        driverId: userId,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        observations: true,
        startKm: true,
        endKm: true,
        status: true,
        truckId: true,
        destinationId: true,
        employeeId: true,
      },
    });
  }

  async addPoints(
    userId: number,
    tripHistoryId: number,
    dto: CreateTripHistoryPointsDto,
  ) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (requester.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Solo el conductor puede enviar puntos GPS');
    }

    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        driverId: true,
        status: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (tripHistory.driverId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este viaje',
      );
    }

    if (tripHistory.status !== TripHistoryStatus.DRIVER_FILLING) {
      throw new BadRequestException('El viaje ya no acepta puntos GPS');
    }

    await this.prisma.tripHistoryPoint.createMany({
      data: dto.points.map((point) => ({
        tripHistoryId: tripHistory.id,
        latitude: point.latitude,
        longitude: point.longitude,
        ...(point.capturedAt ? { capturedAt: new Date(point.capturedAt) } : {}),
      })),
    });

    return {
      inserted: dto.points.length,
    };
  }

  async getAdminRoute(requesterId: number, tripHistoryId: number) {
    const tripHistory = await this.assertAdminTripAccess(requesterId, tripHistoryId);

    const rawPoints = await this.prisma.tripHistoryPoint.findMany({
      where: {
        tripHistoryId: tripHistory.id,
      },
      orderBy: {
        id: 'asc',
      },
      select: {
        latitude: true,
        longitude: true,
        capturedAt: true,
      },
    });

    const snappedPoints = await this.googleRoadsService.snapToRoads(
      rawPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    );

    return {
      tripHistoryId: tripHistory.id,
      snappedPoints,
    };
  }

  async finishTrip(userId: number, tripHistoryId: number, dto: FinishTripDto) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (requester.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Solo el conductor puede finalizar el viaje');
    }

    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        driverId: true,
        truckId: true,
        startKm: true,
        status: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (tripHistory.driverId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para finalizar este viaje',
      );
    }

    if (tripHistory.status !== TripHistoryStatus.DRIVER_FILLING) {
      throw new BadRequestException(
        'El viaje debe estar en estado DRIVER_FILLING para finalizarse',
      );
    }

    const tripPoints = await this.prisma.tripHistoryPoint.findMany({
      where: {
        tripHistoryId: tripHistory.id,
      },
      orderBy: [
        {
          capturedAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      select: {
        latitude: true,
        longitude: true,
      },
    });
    const finalPoints = dto.points ?? [];
    const pointsForDistance = [
      ...tripPoints,
      ...finalPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    ];

    let routePoints = pointsForDistance;

    try {
      routePoints = await this.googleRoadsService.snapToRoads(pointsForDistance);
    } catch {
      routePoints = pointsForDistance;
    }

    const traveledKm = this.calculateRouteDistanceKm(routePoints);
    const endKm = Number((tripHistory.startKm + traveledKm).toFixed(3));
    const signatureKey = this.buildSignatureKey(tripHistory.id);
    await this.s3Service.uploadBase64Image({
      base64DataUrl: dto.signature,
      key: signatureKey,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (finalPoints.length) {
          await tx.tripHistoryPoint.createMany({
            data: finalPoints.map((point) => ({
              tripHistoryId: tripHistory.id,
              latitude: point.latitude,
              longitude: point.longitude,
              ...(point.capturedAt ? { capturedAt: new Date(point.capturedAt) } : {}),
            })),
          });
        }

        const updatedTrip = await tx.tripHistory.update({
          where: { id: tripHistory.id },
          data: {
            endTime: dto.endTime,
            endKm,
            status: TripHistoryStatus.COMPLETED,
            signatureKey,
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            observations: true,
            startKm: true,
            endKm: true,
            status: true,
            truckId: true,
            destinationId: true,
            employeeId: true,
          },
        });

        await tx.truck.update({
          where: { id: tripHistory.truckId },
          data: {
            mileage: endKm,
          },
        });

        return updatedTrip;
      });
    } catch (error) {
      await this.s3Service.deleteObject(signatureKey);
      throw error;
    }
  }

  private buildSignatureKey(tripHistoryId: number): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    return `trip-history/${year}/${month}/${day}/${tripHistoryId}-${randomUUID()}.png`;
  }

  private calculateRouteDistanceKm(
    points: Array<{ latitude: number; longitude: number }>,
  ): number {
    if (points.length < 2) {
      return 0;
    }

    let totalMeters = 0;

    for (let index = 1; index < points.length; index += 1) {
      totalMeters += this.haversineMeters(points[index - 1], points[index]);
    }

    return totalMeters / 1000;
  }

  private haversineMeters(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ): number {
    const earthRadiusMeters = 6371000;
    const latitudeDelta = this.toRadians(b.latitude - a.latitude);
    const longitudeDelta = this.toRadians(b.longitude - a.longitude);
    const startLat = this.toRadians(a.latitude);
    const endLat = this.toRadians(b.latitude);

    const sinLatitude = Math.sin(latitudeDelta / 2);
    const sinLongitude = Math.sin(longitudeDelta / 2);
    const haversineValue =
      sinLatitude * sinLatitude +
      Math.cos(startLat) * Math.cos(endLat) * sinLongitude * sinLongitude;

    return (
      2 *
      earthRadiusMeters *
      Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
    );
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  async updateByAdmin(
    requesterId: number,
    tripHistoryId: number,
    dto: UpdateTripHistoryDto,
  ) {
    await this.assertAdminTripAccess(requesterId, tripHistoryId);
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });
    const isGlobalAdmin = requester?.role === UserRole.ADMIN;

    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        startKm: true,
        endKm: true,
        truckId: true,
        destinationId: true,
        employeeId: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    const nextStartKm = dto.startKm ?? tripHistory.startKm;
    const nextEndKm = dto.endKm ?? tripHistory.endKm;

    if (nextEndKm !== null && nextEndKm < nextStartKm) {
      throw new BadRequestException(
        'El kilometraje final no puede ser menor al kilometraje inicial',
      );
    }

    if (dto.truckId !== undefined) {
      const truck = await this.prisma.truck.findUnique({
        where: { id: dto.truckId },
        select: { id: true, managedById: true },
      });

      if (!truck) {
        throw new NotFoundException('Camión no encontrado');
      }
      if (!isGlobalAdmin && truck.managedById !== requesterId) {
        throw new ForbiddenException('No tienes permiso para usar este camión');
      }
    }

    if (dto.destinationId !== undefined) {
      const destination = await this.prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true, managedById: true },
      });

      if (!destination) {
        throw new NotFoundException('Destino no encontrado');
      }
      if (!isGlobalAdmin && destination.managedById !== requesterId) {
        throw new ForbiddenException('No tienes permiso para usar este destino');
      }
    }

    if (dto.driverId !== undefined) {
      const driverUser = await this.prisma.user.findUnique({
        where: { id: dto.driverId },
        select: { id: true, role: true, managedById: true },
      });

      if (!driverUser) {
        throw new NotFoundException('Conductor no encontrado');
      }

      if (driverUser.role !== UserRole.DRIVER) {
        throw new BadRequestException('El usuario indicado no es un conductor');
      }
      if (!isGlobalAdmin && driverUser.managedById !== requesterId) {
        throw new ForbiddenException('No tienes permiso para usar este conductor');
      }
    }

    if (dto.employeeId !== undefined) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { id: true, active: true, managedById: true },
      });

      if (!employee) {
        throw new NotFoundException('Funcionario no encontrado');
      }

      if (!employee.active && employee.id !== tripHistory.employeeId) {
        throw new BadRequestException(
          'No se puede asignar un funcionario inactivo',
        );
      }
      if (!isGlobalAdmin && employee.managedById !== requesterId) {
        throw new ForbiddenException('No tienes permiso para usar este funcionario');
      }
    }

    const dateForUpdate = dto.date
      ? (() => {
          const parsed = this.parseDateOnly(dto.date);
          if (!parsed) {
            throw new BadRequestException('Fecha inválida');
          }
          return parsed;
        })()
      : null;

    const data: Prisma.TripHistoryUpdateInput = {
      ...(dateForUpdate ? { date: dateForUpdate } : {}),
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.observations !== undefined ? { observations: dto.observations } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startKm !== undefined ? { startKm: dto.startKm } : {}),
      ...(dto.endKm !== undefined ? { endKm: dto.endKm } : {}),
      ...(dto.truckId !== undefined ? { truckId: dto.truckId } : {}),
      ...(dto.destinationId !== undefined
        ? { destinationId: dto.destinationId }
        : {}),
      ...(dto.driverId !== undefined ? { driverId: dto.driverId } : {}),
      ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
    };

    return this.prisma.tripHistory.update({
      where: { id: tripHistory.id },
      data,
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
          },
        },
        destination: {
          select: {
            id: true,
            name: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(requesterId: number, tripHistoryId: number): Promise<void> {
    const tripHistory = await this.assertAdminTripAccess(requesterId, tripHistoryId);

    await this.prisma.tripHistory.delete({
      where: { id: tripHistoryId },
    });

    if (tripHistory.signatureKey) {
      await this.s3Service.deleteObject(tripHistory.signatureKey);
    }
  }
}

