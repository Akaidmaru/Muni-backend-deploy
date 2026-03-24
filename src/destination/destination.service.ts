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
};

@Injectable()
export class DestinationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDestinationDto): Promise<DestinationResponse> {
    const existing = await this.prisma.destination.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException(`El destino "${data.name}" ya existe`);
    }

    const destination = await this.prisma.destination.create({
      data,
      select: {
        id: true,
        name: true,
      },
    });

    return destination as DestinationResponse;
  }

  async findAll(): Promise<DestinationResponse[]> {
    const destinations = await this.prisma.destination.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });

    return destinations as DestinationResponse[];
  }

  async findOne(id: number): Promise<DestinationResponse> {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
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

    const destination = await this.prisma.destination.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
      },
    });

    return destination as DestinationResponse;
  }

  async remove(id: number): Promise<DestinationResponse> {
    await this.findOne(id);

    const tripHistoryCount = await this.prisma.tripHistory.count({
      where: { destinationId: id },
    });

    if (tripHistoryCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el destino porque tiene ${tripHistoryCount} viaje(s) asociado(s)`,
      );
    }

    const destination = await this.prisma.destination.delete({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    return destination as DestinationResponse;
  }
}
