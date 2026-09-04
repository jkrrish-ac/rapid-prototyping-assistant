import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { StagesService } from './stages.service';

/**
 * Shares the "projects/:projectId/prototype" route prefix with
 * PrototypesController (a different controller, in a different module) —
 * this lives here rather than there specifically to avoid a circular module
 * dependency, since repairing needs StagesService (which already depends on
 * PrototypesService) rather than the other way around.
 */
@Controller('projects/:projectId/prototype')
@UseGuards(JwtAuthGuard)
export class PrototypeRepairController {
  constructor(private stages: StagesService) {}

  @Post('repair')
  repair(@Param('projectId') projectId: string, @CurrentUser() user: RequestUser) {
    return this.stages.repairPrototypeNow(projectId, user.userId);
  }
}
