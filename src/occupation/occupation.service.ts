import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOccupationDto } from './dto/create-occupation.dto';
import { UpdateOccupationDto } from './dto/update-occupation.dto';

@Injectable()
export class OccupationService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateOccupationDto) {
    // Verificar que el nombre no existe
    const existing = await this.prisma.occupation.findFirst({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException(`La ocupación "${data.name}" ya existe`);
    }

    return this.prisma.occupation.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.occupation.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const occupation = await this.prisma.occupation.findUnique({
      where: { id },
    });

    if (!occupation) {
      throw new NotFoundException(`Ocupación con ID ${id} no encontrada`);
    }

    return occupation;
  }

  async update(id: number, data: UpdateOccupationDto) {
    // Verificar que existe
    await this.findOne(id);

    // Si se actualiza el nombre, verificar que no exista uno igual
    if (data.name) {
      const existing = await this.prisma.occupation.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`La ocupación "${data.name}" ya existe`);
      }
    }

    return this.prisma.occupation.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    // Verificar que existe
    await this.findOne(id);

    // Verificar que no hay usuarios asociados
    const usersCount = await this.prisma.user.count({
      where: { occupationId: id },
    });

    if (usersCount > 0) {
      throw new ConflictException(
        `No se puede eliminar la ocupación porque hay ${usersCount} usuario(s) asociado(s)`,
      );
    }

    return this.prisma.occupation.delete({
      where: { id },
    });
  }
}
