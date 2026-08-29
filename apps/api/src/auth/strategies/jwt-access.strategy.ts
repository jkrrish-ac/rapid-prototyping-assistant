import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      // The preview iframe and the zip download link can't attach an
      // Authorization header (browser-initiated navigation/downloads), so
      // those two routes are allowed to pass the access token as ?token=
      // instead. Every other route uses the standard bearer header.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.query?.token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email };
  }
}
