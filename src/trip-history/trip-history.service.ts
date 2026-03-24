import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FinishTripDto } from './dto/finish-trip.dto';
import { StartTripDto } from './dto/start-trip.dto';

type FindAllOptions = {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  name?: string;
  license?: string;
};

@Injectable()
export class TripHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number, options: FindAllOptions) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const page =
      Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
    const pageSize =
      Number.isInteger(options.pageSize) && options.pageSize > 0
        ? Math.min(options.pageSize, 100)
        : 10;

    const whereAnd: Prisma.TripHistoryWhereInput[] = [];

    if (requester.role !== UserRole.ADMIN) {
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

    const where: Prisma.TripHistoryWhereInput =
      whereAnd.length > 0 ? { AND: whereAnd } : {};

    const total = await this.prisma.tripHistory.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);

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
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  }

  async startTrip(userId: number, dto: StartTripDto) {
    const assignment = await this.prisma.truckAssignment.findFirst({
      where: {
        userId,
        truck: {
          plate: dto.plate,
        },
      },
      select: {
        truckId: true,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'La patente seleccionada no está asignada al usuario autenticado',
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

    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, name: true },
    });

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
        truckId: true,
        destinationId: true,
        employeeId: true,
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

    return this.prisma.tripHistory.update({
      where: { id: tripHistory.id },
      data: {
        endTime: dto.endTime,
        endKm: tripHistory.startKm,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        startKm: true,
        endKm: true,
        truckId: true,
        destinationId: true,
        employeeId: true,
      },
    });
  }
}
