import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RoutePointDto } from './dto/route-point.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RouteService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateRouteDto) {
    return await this.prisma.route.create({
      data: {
        origin: dto.origin,
        destination: dto.destination,
        truckId: dto.truckId,
        points: {
          create: this.mapPoints(dto.points),
        },
      },
      include: { points: true },
    });
  }

  async findAll() {
    return await this.prisma.route.findMany({ include: { points: true } });
  }

  async findOne(id: number) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: { points: true },
    });

    if (!route) {
      throw new NotFoundException(`Route with id ${id} not found`);
    }

    return route;
  }

  async update(id: number, dto: UpdateRouteDto) {
    // Ensure the route exists before updating
    await this.findOne(id);

    return await this.prisma.$transaction(async (tx) => {
      if (dto.points) {
        await tx.routePoint.deleteMany({ where: { routeId: id } });
      }

      return await tx.route.update({
        where: { id },
        data: {
          ...(dto.origin !== undefined && { origin: dto.origin }),
          ...(dto.destination !== undefined && {
            destination: dto.destination,
          }),
          ...(dto.truckId !== undefined && { truckId: dto.truckId }),
          ...(dto.points && {
            points: { create: this.mapPoints(dto.points) },
          }),
        },
        include: { points: true },
      });
    });
  }

  async remove(id: number) {
    // Ensure the route exists before deleting
    await this.findOne(id);

    return await this.prisma.$transaction(async (tx) => {
      await tx.routePoint.deleteMany({ where: { routeId: id } });
      return await tx.route.delete({ where: { id } });
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapPoints(points: RoutePointDto[]) {
    return points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      order: point.order,
    }));
  }
}
