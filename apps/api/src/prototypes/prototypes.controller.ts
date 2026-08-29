import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { PrototypesService } from './prototypes.service';

@Controller('projects/:projectId/prototype')
@UseGuards(JwtAuthGuard)
export class PrototypesController {
  constructor(private prototypes: PrototypesService) {}

  @Get()
  metadata(@Param('projectId') projectId: string, @CurrentUser() user: RequestUser) {
    return this.prototypes.getMetadata(projectId, user.userId);
  }

  @Get('preview')
  async preview(
    @Param('projectId') projectId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const html = await this.prototypes.renderPreview(projectId, user.userId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('download')
  async download(
    @Param('projectId') projectId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    await this.prototypes.streamDownload(projectId, user.userId, res);
  }
}
