import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
// @ts-ignore - passport-github2 ships loose types
import { Strategy } from 'passport-github2';

/**
 * GitHub OAuth strategy, scaffolded per the PRD (Layer 1 — Platform Auth).
 * See google.strategy.ts for the placeholder-credential boot behavior.
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('oauth.github.clientId') || 'not-configured';
    const clientSecret =
      config.get<string>('oauth.github.clientSecret') || 'not-configured';
    const callbackURL =
      config.get<string>('oauth.github.callbackUrl') ||
      'http://localhost:4000/auth/github/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: unknown, user?: unknown) => void,
  ) {
    const email = profile.emails?.[0]?.value ?? `${profile.username}@users.noreply.github.com`;
    done(null, {
      provider: 'github' as const,
      providerId: String(profile.id),
      email,
      name: profile.displayName || profile.username || 'GitHub User',
    });
  }
}
