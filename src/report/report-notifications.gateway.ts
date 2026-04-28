import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

export interface TruckExpiryPayload {
  notificationId: string;
  truckId: number;
  plate: string;
  documentType: string;
  documentLabel: string;
  expiresAt: string;
  daysUntilExpiry: 7 | 1;
}
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parseCorsOrigins } from '../common/cors-origins';
import { PrismaService } from '../prisma/prisma.service';

interface SocketAuthPayload {
  sub: number;
}

interface ConnectedUser {
  userId: number;
  role: UserRole;
}

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  },
})
export class ReportNotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ReportNotificationsGateway.name);
  private readonly connectedUsersBySocketId = new Map<string, ConnectedUser>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log('Gateway de notificaciones de reportes inicializado');
  }

  onModuleDestroy() {
    this.connectedUsersBySocketId.clear();
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('Token de socket no enviado');
      }

      const payload = this.jwtService.verify<SocketAuthPayload>(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new UnauthorizedException('Usuario de socket no encontrado');
      }

      this.connectedUsersBySocketId.set(client.id, {
        userId: user.id,
        role: user.role,
      });

      await client.join(this.getUserRoom(user.id));
      await client.join(this.getRoleRoom(user.role));
    } catch (error) {
      this.logger.warn(
        `Conexion de socket rechazada: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.connectedUsersBySocketId.delete(client.id);
  }

  emitReportCreatedToAdmins(payload: unknown): void {
    this.server.to(this.getRoleRoom(UserRole.ADMIN)).emit('report:created', payload);
  }

  emitReportUpdatedToUser(userId: number, payload: unknown): void {
    this.server.to(this.getUserRoom(userId)).emit('report:updated', payload);
  }

  emitTruckExpiryToAdmins(payload: TruckExpiryPayload): void {
    this.server.to(this.getRoleRoom(UserRole.ADMIN)).emit('truck:expiry', payload);
  }

  emitServiceRequestCreatedToAdmins(payload: unknown): void {
    this.server
      .to(this.getRoleRoom(UserRole.ADMIN))
      .emit('service-request:created', payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    return null;
  }

  private getRoleRoom(role: UserRole): string {
    return `role:${role}`;
  }

  private getUserRoom(userId: number): string {
    return `user:${userId}`;
  }
}
