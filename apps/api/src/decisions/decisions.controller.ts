import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { DecisionsService } from './decisions.service';
import { ProjectsService } from '../projects/projects.service';
import { SupersedeDecisionDto } from './dto/supersede-decision.dto';

@Controller('projects/:projectId/decisions')
@UseGuards(JwtAuthGuard)
export class DecisionsController {
  constructor(
    private decisions: DecisionsService,
    private projects: ProjectsService,
  ) {}

  @Get()
  async list(@Param('projectId') projectId: string, @CurrentUser() user: RequestUser) {
    await this.projects.findOwned(projectId, user.userId);
    return this.decisions.list(projectId);
  }

  @Patch(':decisionId')
  async supersede(
    @Param('projectId') projectId: string,
    @Param('decisionId') decisionId: string,
    @Body() dto: SupersedeDecisionDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.projects.findOwned(projectId, user.userId);
    return this.decisions.supersede(projectId, decisionId, {
      stage: dto.stage,
      model: dto.model,
      draft: {
        decision: dto.decision,
        context: dto.context,
        options: dto.options,
        rationale: dto.rationale,
        impact: dto.impact,
      },
    });
  }
}
