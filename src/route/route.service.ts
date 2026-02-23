import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RoutePointDto } from './dto/route-point.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { HttpException } from '@nestjs/common';

@Injectable()
export class RouteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteDto) {
    return await this.prisma.route.create({
      data: {
        origin: dto.origin,
        destiny: dto.destiny,
        truckId: dto.truckId,
        points: {
          create: dto.points.map((point: RoutePointDto) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            order: point.order,
          })),
        },
      },
      include: { points: true },
    });
  }

  async findAll() {
    return await this.prisma.route.findMany({ include: { points: true } });
  }

  async findOne(id: number) {
    return await this.prisma.route.findUnique({
      where: { id },
      include: { points: true },
    });
  }

  async update(id: number, dto: UpdateRouteDto) {
    return await this.prisma.$transaction(async (tx) => {
      // Si se envían nuevos puntos, eliminamos los anteriores
      if (dto.points) {
        await tx.routePoint.deleteMany({ where: { routeId: id } });
      }

      return await tx.route.update({
        where: { id },
        data: {
          origin: dto.origin,
          destiny: dto.destiny,
          truckId: dto.truckId,
          points: dto.points
            ? {
                create: dto.points.map((point: RoutePointDto) => ({
                  latitude: point.latitude,
                  longitude: point.longitude,
                  order: point.order,
                })),
              }
            : undefined,
        },
        include: { points: true },
      });
    });
  }

  async remove(id: number) {
    return await this.prisma.$transaction(async (tx) => {
      // Eliminamos los puntos asociados primero
      await tx.routePoint.deleteMany({ where: { routeId: id } });
      // Luego eliminamos la ruta
      return await tx.route.delete({ where: { id } });
    });
  }

  async snapToRoads(
    points: { latitude: number; longitude: number }[],
  ): Promise<{ latitude: number; longitude: number }[]> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new HttpException('Google Maps API key not set', 500);
    }
    const path = points.map((p) => `${p.latitude},${p.longitude}`).join('|');
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${apiKey}`;
    const res: Response = await fetch(url);
    const data = (await res.json()) as {
      error?: { message: string };
      snappedPoints?: Array<{
        location: { latitude: number; longitude: number };
      }>;
    };
    if (data.error) {
      throw new HttpException(data.error.message, 500);
    }
    return (
      data.snappedPoints?.map((p) => ({
        latitude: p.location.latitude,
        longitude: p.location.longitude,
      })) || []
    );
  }
}
