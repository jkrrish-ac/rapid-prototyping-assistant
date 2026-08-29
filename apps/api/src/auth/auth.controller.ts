import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private users: UsersService,
    private config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  refresh(@Body() _dto: RefreshDto, @CurrentUser() user: RequestUser) {
    return this.authService.refresh(user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const found = await this.users.findById(user.userId);
    return found ? this.users.toPublic(found) : null;
  }

  // ---- OAuth: Google ----
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Redirect handled by passport-google-oauth20.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this.handleOAuthCallback(req, res);
  }

  // ---- OAuth: GitHub ----
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {
    // Redirect handled by passport-github2.
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    await this.handleOAuthCallback(req, res);
  }

  private async handleOAuthCallback(req: Request, res: Response) {
    const oauthUser = req.user as {
      provider: 'google' | 'github';
      providerId: string;
      email: string;
      name: string;
    };
    const tokens = await this.authService.loginWithOAuth(oauthUser);
    const webOrigin = this.config.get<string>('cors.origin');
    // Hand the tokens to the platform frontend via a redirect fragment so
    // they never touch server logs or a shareable URL query string.
    const redirectUrl = `${webOrigin}/oauth/callback#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    res.redirect(redirectUrl);
  }
}
