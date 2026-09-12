import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET') as string,
    });
  }

  // El resultado de validate() se inyecta como req.user (ver CurrentUser).
  async validate(payload: any): Promise<AuthenticatedUser> {
    return {
      userId: payload.sub,
      email: payload.email,
      hotelId: payload.hotelId,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
