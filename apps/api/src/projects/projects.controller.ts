import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projects.listForUser(user.userId);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projects.create(user.userId, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.findOwned(id, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projects.update(id, user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projects.softDelete(id, user.userId);
  }
}
