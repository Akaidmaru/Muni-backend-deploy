import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripHistoryStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

export type DestinationResponse = {
  id: number;
  name: string;
  active: boolean;
  managedById?: number | null;
  managedBy?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  tripsCount?: number;
  lastTripDate?: string | null;
  status?: 'En transcurso' | 'Completado' | null;
};

@Injectable()
export class DestinationService {
  constructor(private readonly prisma: PrismaService) {}

  private async getManagedById(requesterId: number): Promise<number | undefined> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });
    if (requester?.role === UserRole.ADMIN) return requesterId;
    if (requester?.role === UserRole.DIRECTION) return requesterId;
    if (requester?.managedById) return requester.managedById;
    return requesterId;
  }

  private async getReadFilter(requesterId: number): Promise<number | undefined> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });
    if (requester?.role === UserRole.ADMIN) return undefined;
    if (requester?.role === UserRole.DIRECTION) return requesterId;
    if (requester?.managedById) return requester.managedById;
    return requesterId;
  }

  private async assertDestinationAccess(requesterId: number, id: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario solicitante no encontrado');
    }

    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: { id: true, managedById: true },
    });

    if (!destination) {
      throw new NotFoundException(`Destino con ID ${id} no encontrado`);
    }

    if (requester.role === UserRole.ADMIN) return destination;

    const allowedManagedById =
      requester.role === UserRole.DIRECTION ? requesterId : requester.managedById;

    if (destination.managedById !== allowedManagedById) {
      throw new ForbiddenException('No tienes permiso para acceder a este destino');
    }

    return destination;
  }

  private async assertManagedByTarget(requesterId: number, managedById?: number) {
    if (managedById === undefined) return;

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (requester?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo un administrador puede cambiar el gestor');
    }

    const manager = await this.prisma.user.findUnique({
      where: { id: managedById },
      select: { id: true, role: true },
    });

    if (
      !manager ||
      (manager.role !== UserRole.ADMIN && manager.role !== UserRole.DIRECTION)
    ) {
      throw new NotFoundException('Usuario gestor no encontrado');
    }
  }

  private async getDriverManagedById(driverId: number): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { managedById: true },
    });
    return user?.managedById ?? null;
  }

  private async enrichDestinationWithTripsInfo(
    destination: DestinationResponse,
  ): Promise<DestinationResponse> {
    const trips = await this.prisma.tripHistory.findMany({
      where: { destinationId: destination.id },
      select: { date: true, status: true },
      orderBy: { date: 'desc' },
    });

    return this.buildEnrichedDestination(destination, trips);
  }

  private async enrichManyDestinationsWithTripsInfo(
    destinations: DestinationResponse[],
  ): Promise<DestinationResponse[]> {
    if (destinations.length === 0) return [];

    const ids = destinations.map((d) => d.id);
    const trips = await this.prisma.tripHistory.findMany({
      where: { destinationId: { in: ids } },
      select: { destinationId: true, date: true, status: true },
      orderBy: { date: 'desc' },
    });

    const tripsByDestination = new Map<number, typeof trips>();
    for (const trip of trips) {
      const list = tripsByDestination.get(trip.destinationId) ?? [];
      list.push(trip);
      tripsByDestination.set(trip.destinationId, list);
    }

    return destinations.map((dest) =>
      this.buildEnrichedDestination(dest, tripsByDestination.get(dest.id) ?? []),
    );
  }

  private buildEnrichedDestination(
    destination: DestinationResponse,
    trips: { date: Date; status: TripHistoryStatus }[],
  ): DestinationResponse {
    const tripsCount = trips.length;
    const hasActiveTrips = trips.some(
      (trip) =>
        trip.status === TripHistoryStatus.DRIVER_FILLING ||
        trip.status === TripHistoryStatus.EMPLOYEE_SIGNED,
    );
    const lastTripDate = trips[0]
      ? trips[0].date.toISOString().split('T')[0]
      : null;

    let calculatedStatus: 'En transcurso' | 'Completado' | null = null;
    if (hasActiveTrips) {
      calculatedStatus = 'En transcurso';
    } else if (tripsCount > 0) {
      calculatedStatus = 'Completado';
    }

    return {
      ...destination,
      tripsCount: tripsCount > 0 ? tripsCount : undefined,
      lastTripDate: lastTripDate || null,
      status: calculatedStatus,
    };
  }

  private get destinationSelect() {
    return {
      id: true,
      name: true,
      active: true,
      managedById: true,
      managedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    };
  }

  async create(requesterId: number, data: CreateDestinationDto): Promise<DestinationResponse> {
    const managedById = (await this.getManagedById(requesterId)) ?? null;
    const normalizedName = data.name.trim();

    const existing = await this.prisma.destination.findFirst({
      where: {
        managedById,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`El destino "${normalizedName}" ya existe`);
    }

    const destination = await this.prisma.destination.create({
      data: { name: normalizedName, active: data.active ?? true, managedById },
      select: this.destinationSelect,
    });

    return await this.enrichDestinationWithTripsInfo(destination as DestinationResponse);
  }

  async findOrCreateActiveByName(name: string, managedById: number | null): Promise<DestinationResponse> {
    const normalizedName = name.trim();

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      throw new ConflictException(
        'El nombre del destino debe tener entre 2 y 120 caracteres',
      );
    }

    const existing = await this.prisma.destination.findFirst({
      where: {
        managedById,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
      select: this.destinationSelect,
    });

    if (existing) {
      if (!existing.active) {
        const updatedDestination = await this.prisma.destination.update({
          where: { id: existing.id },
          data: { active: true },
          select: this.destinationSelect,
        });
        return await this.enrichDestinationWithTripsInfo(updatedDestination as DestinationResponse);
      }
      return await this.enrichDestinationWithTripsInfo(existing as DestinationResponse);
    }

    const destination = await this.prisma.destination.create({
      data: { name: normalizedName, active: true, managedById },
      select: this.destinationSelect,
    });

    return await this.enrichDestinationWithTripsInfo(destination as DestinationResponse);
  }

  async findAll(requesterId: number): Promise<DestinationResponse[]> {
    const managedById = await this.getReadFilter(requesterId);
    const destinations = await this.prisma.destination.findMany({
      where: managedById !== undefined ? { managedById } : {},
      orderBy: { name: 'asc' },
      select: this.destinationSelect,
    });

    return this.enrichManyDestinationsWithTripsInfo(destinations as DestinationResponse[]);
  }

  async findAllActive(requesterId: number): Promise<DestinationResponse[]> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, managedById: true },
    });

    let whereFilter = {};
    if (requester?.role === UserRole.ADMIN) {
      whereFilter = { active: true };
    } else if (requester?.role === UserRole.DIRECTION) {
      whereFilter = { active: true, managedById: requesterId };
    } else {
      whereFilter = { active: true, managedById: requester?.managedById };
    }

    const destinations = await this.prisma.destination.findMany({
      where: whereFilter,
      orderBy: { name: 'asc' },
      select: this.destinationSelect,
    });

    return this.enrichManyDestinationsWithTripsInfo(destinations as DestinationResponse[]);
  }

  async findOne(id: number, requesterId?: number): Promise<DestinationResponse> {
    if (requesterId !== undefined) {
      await this.assertDestinationAccess(requesterId, id);
    }

    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: this.destinationSelect,
    });

    if (!destination) {
      throw new NotFoundException(`Destino con ID ${id} no encontrado`);
    }

    return await this.enrichDestinationWithTripsInfo(
      destination as DestinationResponse,
    );
  }

  async update(
    requesterId: number,
    id: number,
    data: UpdateDestinationDto,
  ): Promise<DestinationResponse> {
    await this.assertDestinationAccess(requesterId, id);
    await this.assertManagedByTarget(requesterId, data.managedById);

    if (data.name) {
      const normalizedName = data.name.trim();
      const current = await this.prisma.destination.findUnique({
        where: { id },
        select: { managedById: true },
      });
      const nextManagedById = data.managedById ?? current?.managedById;
      const existing = await this.prisma.destination.findFirst({
        where: {
          managedById: nextManagedById,
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`El destino "${normalizedName}" ya existe`);
      }

      data.name = normalizedName;
    }

    const updateData: {
      name?: string;
      active?: boolean;
      managedById?: number;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    if (data.managedById !== undefined) {
      updateData.managedById = data.managedById;
    }

    const destination = await this.prisma.destination.update({
      where: { id },
      data: updateData,
      select: this.destinationSelect,
    });

    return await this.enrichDestinationWithTripsInfo(
      destination as DestinationResponse,
    );
  }

  async remove(requesterId: number, id: number): Promise<DestinationResponse> {
    const currentDestination = await this.findOne(id, requesterId);

    const tripHistoryCount = await this.prisma.tripHistory.count({
      where: { destinationId: id },
    });

    if (tripHistoryCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el destino porque tiene ${tripHistoryCount} viaje(s) asociado(s)`,
      );
    }

    await this.prisma.destination.delete({ where: { id } });

    return currentDestination;
  }
}
