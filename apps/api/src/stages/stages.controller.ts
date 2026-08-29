import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { StagesService } from './stages.service';
import { PostMessageDto } from './dto/post-message.dto';
import { LifecycleStage } from '../common/lifecycle/stage.types';

function parseStage(value: string): LifecycleStage {
  const stage = value.toUpperCase() as LifecycleStage;
  if (!Object.values(LifecycleStage).includes(stage)) {
    throw new BadRequestException(`Unknown stage "${value}".`);
  }
  return stage;
}

@Controller('projects/:projectId/stages')
@UseGuards(JwtAuthGuard)
export class StagesController {
  constructor(private stages: StagesService) {}

  @Get()
  list(@Param('projectId') projectId: string, @CurrentUser() user: RequestUser) {
    return this.stages.listForProject(projectId, user.userId);
  }

  @Get(':stage')
  detail(
    @Param('projectId') projectId: string,
    @Param('stage') stage: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.stages.getStage(projectId, user.userId, parseStage(stage));
  }

  @Post(':stage/messages')
  postMessage(
    @Param('projectId') projectId: string,
    @Param('stage') stage: string,
    @Body() dto: PostMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.stages.postMessage(projectId, user.userId, parseStage(stage), dto.message);
  }

  @Post(':stage/advance')
  advance(
    @Param('projectId') projectId: string,
    @Param('stage') stage: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.stages.advance(projectId, user.userId, parseStage(stage));
  }
}
