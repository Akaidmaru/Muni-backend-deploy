import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

export type DestinationResponse = {
  id: number;
  name: string;
  active: boolean;
  tripsCount?: number;
  lastTripDate?: string | null;
  status?: 'En transcurso' | 'Completado' | null;
};

@Injectable()
export class DestinationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enriquece un destino con información de viajes asociados
   */
  private async enrichDestinationWithTripsInfo(
    destination: DestinationResponse,
  ): Promise<DestinationResponse> {
    // Obtener todos los viajes para este destino
    const trips = await this.prisma.tripHistory.findMany({
      where: { destinationId: destination.id },
      select: {
        id: true,
        date: true,
        status: true,
      },
      orderBy: { date: 'desc' },
    });

    // Contar total de viajes
    const tripsCount = trips.length;

    // Determinar el estado: hay viajes en transcurso?
    const hasActiveTrips = trips.some(
      (trip) => trip.status === 'DRIVER_FILLING' || trip.status === 'EMPLOYEE_SIGNED',
    );

    // Obtener el último viaje (date más reciente)
    const lastTrip = trips.length > 0 ? trips[0] : null;
    const lastTripDate = lastTrip
      ? lastTrip.date.toISOString().split('T')[0]
      : null;

    // Calcular estado
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
    };
  }

  async create(data: CreateDestinationDto): Promise<DestinationResponse> {
    const existing = await this.prisma.destination.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException(`El destino "${data.name}" ya existe`);
    }

    const destination = await this.prisma.destination.create({
      data: {
        name: data.name,
        active: data.active ?? true,
      },
      select: this.destinationSelect,
    });

    return await this.enrichDestinationWithTripsInfo(
      destination as DestinationResponse,
    );
  }

  async findOrCreateActiveByName(name: string): Promise<DestinationResponse> {
    const normalizedName = name.trim();

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      throw new ConflictException(
        'El nombre del destino debe tener entre 2 y 120 caracteres',
      );
    }

    const existing = await this.prisma.destination.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
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

        return await this.enrichDestinationWithTripsInfo(
          updatedDestination as DestinationResponse,
        );
      }

      return await this.enrichDestinationWithTripsInfo(
        existing as DestinationResponse,
      );
    }

    const destination = await this.prisma.destination.create({
      data: {
        name: normalizedName,
        active: true,
      },
      select: this.destinationSelect,
    });

    return await this.enrichDestinationWithTripsInfo(
      destination as DestinationResponse,
    );
  }

  async findAll(): Promise<DestinationResponse[]> {
    const destinations = await this.prisma.destination.findMany({
      orderBy: { name: 'asc' },
      select: this.destinationSelect,
    });

    const enrichedDestinations = await Promise.all(
      (destinations as DestinationResponse[]).map((dest) =>
        this.enrichDestinationWithTripsInfo(dest),
      ),
    );

    return enrichedDestinations;
  }

  async findAllActive(): Promise<DestinationResponse[]> {
    const destinations = await this.prisma.destination.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: this.destinationSelect,
    });

    const enrichedDestinations = await Promise.all(
      (destinations as DestinationResponse[]).map((dest) =>
        this.enrichDestinationWithTripsInfo(dest),
      ),
    );

    return enrichedDestinations;
  }

  async findOne(id: number): Promise<DestinationResponse> {
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
    id: number,
    data: UpdateDestinationDto,
  ): Promise<DestinationResponse> {
    await this.findOne(id);

    if (data.name) {
      const existing = await this.prisma.destination.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`El destino "${data.name}" ya existe`);
      }
    }

    const updateData: {
      name?: string;
      active?: boolean;
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.active !== undefined) {
      updateData.active = data.active;
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

  async remove(id: number): Promise<DestinationResponse> {
    const currentDestination = await this.findOne(id);

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
