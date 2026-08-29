import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * Google OAuth 2.0 strategy, scaffolded per the PRD (Layer 1 — Platform Auth).
 *
 * If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set, placeholder values
 * are used so the app still boots in dev without OAuth configured — the
 * /auth/google routes will simply fail at Google's end until you supply
 * real credentials in .env.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('oauth.google.clientId') || 'not-configured';
    const clientSecret =
      config.get<string>('oauth.google.clientSecret') || 'not-configured';
    const callbackURL =
      config.get<string>('oauth.google.callbackUrl') ||
      'http://localhost:4000/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName ?? email ?? 'Google User';
    done(null, {
      provider: 'google' as const,
      providerId: profile.id,
      email,
      name,
    });
  }
}
