import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, TripHistoryStatus, TruckStatus, UserRole } from '@prisma/client';
import { S3Service } from '../common/s3.service';
import { DestinationService } from '../destination/destination.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleRoadsService } from '../route/googleRoads.service';
import { AssignTripPatientDto } from './dto/assign-trip-patient.dto';
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
  patient?: string;
  license?: string;
};

type PaginationData = {
  page: number;
  pageSize: number;
};

@Injectable()
export class TripHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly googleRoadsService: GoogleRoadsService,
    private readonly destinationService: DestinationService,
  ) {}

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
          OR: [
            {
              name: {
                contains: options.name,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: options.name,
                mode: 'insensitive',
              },
            },
          ],
        },
      });
    }

    if (options.patient) {
      whereAnd.push({
        patient: {
          name: {
            contains: options.patient,
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
            users: {
              select: {
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
        },
        destination: {
          select: {
            id: true,
            name: true,
            patients: {
              select: {
                id: true,
                name: true,
              },
              orderBy: {
                name: 'asc',
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
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
        const preferredDriverAssignment = item.truck.users.find(
          (assignment) => assignment.user.role === UserRole.DRIVER,
        );
        const fallbackAssignment = item.truck.users[0];
        const resolvedDriverAssignment =
          preferredDriverAssignment ?? fallbackAssignment;

        const [signatureUrl, signatureDataUrl] = item.signatureKey
          ? await Promise.all([
              this.s3Service
                .getSignedGetUrl(item.signatureKey)
                .catch(() => null),
              this.s3Service
                .getObjectDataUrl(item.signatureKey)
                .catch(() => null),
            ])
          : [null, null];

        return {
          ...item,
          signatureUrl,
          signatureDataUrl,
          truck: {
            id: item.truck.id,
            plate: item.truck.plate,
          },
          driver: resolvedDriverAssignment
            ? {
                id: resolvedDriverAssignment.user.id,
                name: resolvedDriverAssignment.user.name,
                email: resolvedDriverAssignment.user.email,
              }
            : null,
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

  async findAll(options: FindAllOptions) {
    const pagination = this.parsePagination(options);
    const whereAnd = this.buildFilters(options);

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

    if (requester.role === UserRole.EMPLOYEE) {
      whereAnd.push({
        employeeId: userId,
      });
    } else if (requester.role !== UserRole.ADMIN) {
      whereAnd.push({
        truck: {
          users: {
            some: {
              userId,
            },
          },
        },
      });
    }

    return this.findWithWhere(whereAnd, pagination);
  }

  async startTrip(userId: number, dto: StartTripDto) {
    const assignment = await this.prisma.truckAssignment.findFirst({
      where: {
        userId,
        truck: {
          plate: dto.plate,
          status: TruckStatus.ACTIVE,
        },
      },
      select: {
        truckId: true,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'La patente seleccionada no está activa o no está asignada al usuario autenticado',
      );
    }

    const truck = await this.prisma.truck.findUnique({
      where: { id: assignment.truckId },
      select: {
        id: true,
        mileage: true,
      },
    });

    if (!truck) {
      throw new NotFoundException('Camión no encontrado');
    }

    const customDestinationName = dto.customDestination?.trim();
    let destination: { id: number; name: string } | null = null;

    if (customDestinationName) {
      destination = await this.destinationService.findOrCreateActiveByName(
        customDestinationName,
      );
    } else if (dto.destinationId) {
      destination = await this.prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true, name: true },
      });
    }

    if (!destination) {
      throw new NotFoundException('Destino no encontrado');
    }

    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, role: true, name: true, email: true },
    });

    if (!employee) {
      throw new NotFoundException('Funcionario no encontrado');
    }

    if (employee.role !== UserRole.EMPLOYEE) {
      throw new BadRequestException(
        'El usuario seleccionado no es funcionario',
      );
    }

    const mileageValue: unknown = truck.mileage;
    if (typeof mileageValue !== 'number' || Number.isNaN(mileageValue)) {
      throw new BadRequestException('El kilometraje del camión es inválido');
    }

    const startKm = mileageValue;

    return this.prisma.tripHistory.create({
      data: {
        date: new Date(),
        startTime: dto.startTime,
        endTime: null,
        status: TripHistoryStatus.DRIVER_FILLING,
        startKm,
        endKm: null,
        truckId: truck.id,
        destinationId: destination.id,
        employeeId: employee.id,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        startKm: true,
        endKm: true,
        status: true,
        truckId: true,
        destinationId: true,
        employeeId: true,
        patientId: true,
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
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
        truckId: true,
        status: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (tripHistory.status !== TripHistoryStatus.DRIVER_FILLING) {
      throw new BadRequestException('El viaje ya no acepta puntos GPS');
    }

    const hasAccess = await this.prisma.truckAssignment.findFirst({
      where: {
        userId,
        truckId: tripHistory.truckId,
      },
      select: { truckId: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'No tiene permisos para enviar puntos GPS para este viaje',
      );
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

  async getAdminRoute(tripHistoryId: number) {
    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

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

  async assignPatient(
    userId: number,
    tripHistoryId: number,
    dto: AssignTripPatientDto,
  ) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        destinationId: true,
        employeeId: true,
        status: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (
      requester.role !== UserRole.ADMIN &&
      requester.role !== UserRole.EMPLOYEE
    ) {
      throw new ForbiddenException('No tiene permisos para asignar pacientes');
    }

    if (
      requester.role === UserRole.EMPLOYEE &&
      tripHistory.employeeId !== userId
    ) {
      throw new ForbiddenException(
        'Solo el funcionario asignado puede registrar el paciente de este viaje',
      );
    }

    const patient = await this.prisma.patient.findFirst({
      where: {
        id: dto.patientId,
        destinationId: tripHistory.destinationId,
      },
      select: { id: true, name: true },
    });

    if (!patient) {
      throw new BadRequestException(
        'El paciente seleccionado no pertenece al destino del viaje',
      );
    }

    if (tripHistory.status !== TripHistoryStatus.COMPLETED) {
      throw new BadRequestException(
        'Solo se puede completar un viaje en estado COMPLETED',
      );
    }

    return this.prisma.tripHistory.update({
      where: { id: tripHistory.id },
      data: {
        patientId: patient.id,
        status: TripHistoryStatus.COMPLETED,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        startKm: true,
        endKm: true,
        status: true,
        truckId: true,
        destinationId: true,
        employeeId: true,
        patientId: true,
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async finishTrip(userId: number, tripHistoryId: number, dto: FinishTripDto) {
    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        truckId: true,
        startKm: true,
        status: true,
      },
    });

    if (!tripHistory) {
      throw new NotFoundException('Viaje no encontrado');
    }

    const hasAccess = await this.prisma.truckAssignment.findFirst({
      where: {
        userId,
        truckId: tripHistory.truckId,
      },
      select: { truckId: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'No tiene permisos para finalizar este viaje',
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

    let routePoints = tripPoints;

    try {
      routePoints = await this.googleRoadsService.snapToRoads(tripPoints);
    } catch {
      routePoints = tripPoints;
    }

    const traveledKm = this.calculateRouteDistanceKm(routePoints);
    const endKm = Number((tripHistory.startKm + traveledKm).toFixed(3));
    const signatureKey = this.buildSignatureKey(tripHistory.id);
    await this.s3Service.uploadBase64Image({
      base64DataUrl: dto.signature,
      key: signatureKey,
    });

    return this.prisma.$transaction(async (tx) => {
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
          startKm: true,
          endKm: true,
          status: true,
          truckId: true,
          destinationId: true,
          employeeId: true,
          patientId: true,
          patient: {
            select: {
              id: true,
              name: true,
            },
          },
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

  async updateByAdmin(tripHistoryId: number, dto: UpdateTripHistoryDto) {
    const tripHistory = await this.prisma.tripHistory.findUnique({
      where: { id: tripHistoryId },
      select: {
        id: true,
        startKm: true,
        endKm: true,
        truckId: true,
        destinationId: true,
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
        select: { id: true },
      });

      if (!truck) {
        throw new NotFoundException('Camion no encontrado');
      }
    }

    if (dto.destinationId !== undefined) {
      const destination = await this.prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true },
      });

      if (!destination) {
        throw new NotFoundException('Destino no encontrado');
      }
    }

    const data: Prisma.TripHistoryUpdateInput = {
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startKm !== undefined ? { startKm: dto.startKm } : {}),
      ...(dto.endKm !== undefined ? { endKm: dto.endKm } : {}),
      ...(dto.truckId !== undefined ? { truckId: dto.truckId } : {}),
      ...(dto.destinationId !== undefined
        ? { destinationId: dto.destinationId }
        : {}),
    };

    const updatedTrip = await this.prisma.tripHistory.update({
      where: { id: tripHistory.id },
      data,
      include: {
        truck: {
          select: {
            id: true,
            plate: true,
            users: {
              select: {
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
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const preferredDriverAssignment = updatedTrip.truck.users.find(
      (assignment) => assignment.user.role === UserRole.DRIVER,
    );
    const fallbackAssignment = updatedTrip.truck.users[0];
    const resolvedDriverAssignment =
      preferredDriverAssignment ?? fallbackAssignment;

    return {
      ...updatedTrip,
      truck: {
        id: updatedTrip.truck.id,
        plate: updatedTrip.truck.plate,
      },
      driver: resolvedDriverAssignment
        ? {
            id: resolvedDriverAssignment.user.id,
            name: resolvedDriverAssignment.user.name,
            email: resolvedDriverAssignment.user.email,
          }
        : null,
    };
  }
}
