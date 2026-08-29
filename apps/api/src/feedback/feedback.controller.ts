import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ProjectsService } from '../projects/projects.service';

@Controller('projects/:projectId/feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(
    private feedback: FeedbackService,
    private projects: ProjectsService,
  ) {}

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.projects.findOwned(projectId, user.userId);
    return this.feedback.create(projectId, dto);
  }

  @Get()
  async list(@Param('projectId') projectId: string, @CurrentUser() user: RequestUser) {
    await this.projects.findOwned(projectId, user.userId);
    return this.feedback.list(projectId);
  }
}
