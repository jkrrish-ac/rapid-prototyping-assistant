import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.create({ email, name, passwordHash });
    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueTokens(user);
  }

  async loginWithOAuth(oauthUser: {
    email: string;
    name: string;
    provider: 'google' | 'github';
    providerId: string;
  }) {
    const user = await this.users.findOrCreateOAuthUser(oauthUser);
    return this.issueTokens(user);
  }

  async refresh(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists.');
    return this.issueTokens(user);
  }

  private issueTokens(user: UserDocument) {
    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl'),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshTtl'),
    });
    return {
      accessToken,
      refreshToken,
      user: this.users.toPublic(user),
    };
  }
}
