import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

export type PatientResponse = {
  id: number;
  name: string;
};

export type DestinationResponse = {
  id: number;
  name: string;
  active: boolean;
  patients: PatientResponse[];
};

@Injectable()
export class DestinationService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePatientNames(patients: string[]): string[] {
    const normalized = patients
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    return [...new Set(normalized)];
  }

  private get destinationSelect() {
    return {
      id: true,
      name: true,
      active: true,
      patients: {
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc' as const,
        },
      },
    };
  }

  async create(data: CreateDestinationDto): Promise<DestinationResponse> {
    const existing = await this.prisma.destination.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException(`El destino "${data.name}" ya existe`);
    }

    const patientNames = this.normalizePatientNames(data.patients);

    if (patientNames.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un paciente con nombre válido',
      );
    }

    const destination = await this.prisma.destination.create({
      data: {
        name: data.name,
        active: data.active,
        patients: {
          create: patientNames.map((name) => ({ name })),
        },
      },
      select: this.destinationSelect,
    });

    return destination as DestinationResponse;
  }

  async findOrCreateActiveByName(name: string): Promise<DestinationResponse> {
    const normalizedName = name.trim();

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      throw new BadRequestException(
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

        return updatedDestination as DestinationResponse;
      }

      return existing as DestinationResponse;
    }

    const destination = await this.prisma.destination.create({
      data: {
        name: normalizedName,
        active: true,
      },
      select: this.destinationSelect,
    });

    return destination as DestinationResponse;
  }

  async findAll(): Promise<DestinationResponse[]> {
    const destinations = await this.prisma.destination.findMany({
      orderBy: { name: 'asc' },
      select: this.destinationSelect,
    });

    return destinations as DestinationResponse[];
  }

  async findAllActive(): Promise<DestinationResponse[]> {
    const destinations = await this.prisma.destination.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: this.destinationSelect,
    });

    return destinations as DestinationResponse[];
  }

  async findOne(id: number): Promise<DestinationResponse> {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: this.destinationSelect,
    });

    if (!destination) {
      throw new NotFoundException(`Destino con ID ${id} no encontrado`);
    }

    return destination as DestinationResponse;
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
      patients?: {
        deleteMany: Record<string, never>;
        create: { name: string }[];
      };
    } = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    if (data.patients !== undefined) {
      const patientNames = this.normalizePatientNames(data.patients);

      if (patientNames.length === 0) {
        throw new BadRequestException(
          'Debe enviar al menos un paciente con nombre válido',
        );
      }

      updateData.patients = {
        deleteMany: {},
        create: patientNames.map((name) => ({ name })),
      };
    }

    const destination = await this.prisma.destination.update({
      where: { id },
      data: updateData,
      select: this.destinationSelect,
    });

    return destination as DestinationResponse;
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
