import { Controller, Get } from '@nestjs/common';

/**
 * A friendly root/health route. This API is meant to be called from the
 * platform web app (or curl) at routes like /auth, /projects, etc. — hitting
 * "/" directly used to 404, which reads as broken when you're just checking
 * the container came up. This confirms it did.
 */
@Controller()
export class AppController {
  @Get()
  root() {
    return {
      name: 'Rapid Prototype Assistant API',
      status: 'ok',
      hint: 'The web app is at http://localhost:5173. Try GET /auth/me (with a bearer token) or POST /auth/register here.',
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
