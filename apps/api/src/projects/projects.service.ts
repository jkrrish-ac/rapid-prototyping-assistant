import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { LifecycleStage, STAGE_ORDER } from '../common/lifecycle/stage.types';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  listForUser(userId: string) {
    return this.projectModel
      .find({ owner: new Types.ObjectId(userId), status: { $ne: 'archived' } })
      .sort({ updatedAt: -1 })
      .exec();
  }

  create(userId: string, dto: CreateProjectDto) {
    return this.projectModel.create({
      owner: new Types.ObjectId(userId),
      name: dto.name,
      description: dto.description ?? '',
      currentStage: LifecycleStage.IDEA,
    });
  }

  async findOwned(projectId: string, userId: string): Promise<ProjectDocument> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new NotFoundException('Project not found.');
    }
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found.');
    if (project.owner.toString() !== userId) {
      throw new ForbiddenException("You don't have access to this project.");
    }
    return project;
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.findOwned(projectId, userId);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status !== undefined) project.status = dto.status;
    await project.save();
    return project;
  }

  async softDelete(projectId: string, userId: string) {
    const project = await this.findOwned(projectId, userId);
    project.status = 'archived';
    await project.save();
    return project;
  }

  nextStage(current: LifecycleStage): LifecycleStage | null {
    const idx = STAGE_ORDER.indexOf(current);
    return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  }

  async advanceToNextStage(projectId: string, userId: string) {
    const project = await this.findOwned(projectId, userId);
    const next = this.nextStage(project.currentStage);
    if (!next) return project; // already at ITERATE, the terminal/looping stage
    project.currentStage = next;
    await project.save();
    return project;
  }

  /**
   * ITERATE can route back to DESIGN (default) or, for fundamental changes,
   * back to IDEATE — the stage panel drives which by the AI's own
   * recommendation, per the PRD.
   */
  async loopBackTo(projectId: string, userId: string, stage: LifecycleStage) {
    const project = await this.findOwned(projectId, userId);
    project.currentStage = stage;
    await project.save();
    return project;
  }
}
