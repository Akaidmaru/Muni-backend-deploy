import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: number;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly redisService: RedisService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required but not set',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    if (token) {
      try {
        const isBlacklisted = await this.redisService.exists(
          `blacklist:${token}`,
        );
        if (isBlacklisted) {
          throw new UnauthorizedException('Token inválido');
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        // Redis no disponible — el JWT sigue teniendo firma válida, permitir request
      }
    }

    try {
      const passwordResetAfterRaw = await this.redisService.get(
        `auth:password-reset-after:${payload.sub}`,
      );
      if (passwordResetAfterRaw) {
        const passwordResetAfter = Number(passwordResetAfterRaw);
        if (
          Number.isFinite(passwordResetAfter) &&
          (!payload.iat || payload.iat < passwordResetAfter)
        ) {
          throw new UnauthorizedException('Token expirado por cambio de contraseña');
        }
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      // Redis no disponible — permitir request
    }

    return {
      id: payload.sub,
    };
  }
}
