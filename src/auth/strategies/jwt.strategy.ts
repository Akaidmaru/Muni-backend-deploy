import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: number;
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
      const isBlacklisted = await this.redisService.exists(
        `blacklist:${token}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token inválido');
      }
    }

    return {
      id: payload.sub,
    };
  }
}
