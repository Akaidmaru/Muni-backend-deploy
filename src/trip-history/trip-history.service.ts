import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TripHistoryStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTripPatientDto } from './dto/assign-trip-patient.dto';
import { FinishTripDto } from './dto/finish-trip.dto';
import { StartTripDto } from './dto/start-trip.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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

    const mappedItems = items.map((item) => {
      const driverAssignment = item.truck.users.find(
        (assignment) => assignment.user.role === UserRole.DRIVER,
      );

      return {
        ...item,
        truck: {
          id: item.truck.id,
          plate: item.truck.plate,
        },
        driver: driverAssignment
          ? {
              id: driverAssignment.user.id,
              name: driverAssignment.user.name,
              email: driverAssignment.user.email,
            }
          : null,
      };
    });

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

    if (tripHistory.status !== TripHistoryStatus.EMPLOYEE_SIGNED) {
      throw new BadRequestException(
        'Solo se puede completar un viaje en estado EMPLOYEE_SIGNED',
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

    return this.prisma.tripHistory.update({
      where: { id: tripHistory.id },
      data: {
        endTime: dto.endTime,
        endKm: tripHistory.startKm,
        status: TripHistoryStatus.EMPLOYEE_SIGNED,
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
}
