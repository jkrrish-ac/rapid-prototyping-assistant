import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Response } from 'express';
import { Prototype, PrototypeDocument } from './prototype.schema';
import { StageState, StageDocument } from '../stages/stage.schema';
import { LifecycleStage } from '../common/lifecycle/stage.types';
import { BundlerService } from './bundler.service';
import { ZipService } from './zip.service';
import { DecisionsService } from '../decisions/decisions.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class PrototypesService {
  constructor(
    @InjectModel(Prototype.name) private prototypeModel: Model<PrototypeDocument>,
    @InjectModel(StageState.name) private stageModel: Model<StageDocument>,
    private bundler: BundlerService,
    private zip: ZipService,
    private decisions: DecisionsService,
    private projects: ProjectsService,
  ) {}

  async saveVersion(
    projectId: string,
    data: { files: { path: string; content: string }[]; mocked: string[]; dependencies: string[] },
  ) {
    const decideDoc = await this.stageModel.findOne({
      project: new Types.ObjectId(projectId),
      stage: LifecycleStage.DECIDE,
    });
    const techStack = (decideDoc?.output as any)?.tech_stack;
    const framework: 'react' | 'vue' =
      typeof techStack?.framework === 'string' && techStack.framework.toLowerCase() === 'vue'
        ? 'vue'
        : 'react';

    const existing = await this.prototypeModel.findOne({
      project: new Types.ObjectId(projectId),
    });

    if (existing) {
      existing.framework = framework;
      existing.version += 1;
      existing.files = data.files as any;
      existing.mocked = data.mocked;
      existing.dependencies = data.dependencies;
      await existing.save();
      return existing;
    }

    return this.prototypeModel.create({
      project: new Types.ObjectId(projectId),
      framework,
      version: 1,
      files: data.files,
      mocked: data.mocked,
      dependencies: data.dependencies,
    });
  }

  async getMetadata(projectId: string, userId: string) {
    await this.projects.findOwned(projectId, userId);
    const proto = await this.prototypeModel.findOne({
      project: new Types.ObjectId(projectId),
    });
    if (!proto) {
      throw new NotFoundException(
        'No prototype has been built yet for this project (BUILD stage not reached).',
      );
    }
    return {
      framework: proto.framework,
      version: proto.version,
      fileCount: proto.files.length,
      files: proto.files.map((f) => f.path),
      mocked: proto.mocked,
      dependencies: proto.dependencies,
      updatedAt: (proto as any).updatedAt,
    };
  }

  async renderPreview(projectId: string, userId: string): Promise<string> {
    await this.projects.findOwned(projectId, userId);
    const proto = await this.prototypeModel.findOne({
      project: new Types.ObjectId(projectId),
    });
    if (!proto) {
      return this.bundler.buildUnsupportedPreviewHtml(
        'No prototype has been built yet — advance this project to the BUILD stage first.',
      );
    }
    if (proto.framework === 'vue') {
      return this.bundler.buildUnsupportedPreviewHtml(
        'Live in-platform preview isn’t available for Vue prototypes yet. Download the source below and run `npm install && npm run dev` to view it locally.',
      );
    }
    const result = await this.bundler.bundleReact(
      proto.files.map((f) => ({ path: f.path, content: f.content })),
    );
    if (!result.ok || !result.js) {
      return this.bundler.buildUnsupportedPreviewHtml(
        `The generated prototype failed to bundle: ${result.error ?? 'unknown error'}. Check the FIX stage.`,
      );
    }
    return this.bundler.buildPreviewHtml(result.js, proto.dependencies);
  }

  async streamDownload(projectId: string, userId: string, res: Response) {
    const project = await this.projects.findOwned(projectId, userId);
    const proto = await this.prototypeModel.findOne({
      project: new Types.ObjectId(projectId),
    });
    if (!proto) {
      throw new NotFoundException('No prototype has been built yet for this project.');
    }

    const [understandDoc, decideDoc, shipDoc] = await Promise.all([
      this.stageModel.findOne({ project: project._id, stage: LifecycleStage.UNDERSTAND }),
      this.stageModel.findOne({ project: project._id, stage: LifecycleStage.DECIDE }),
      this.stageModel.findOne({ project: project._id, stage: LifecycleStage.SHIP }),
    ]);

    const decisionsMarkdown = await this.decisions.renderMarkdown(projectId, project.name);

    return this.zip.streamProjectZip(res, {
      projectName: project.name,
      framework: proto.framework,
      files: proto.files.map((f) => ({ path: f.path, content: f.content })),
      dependencies: proto.dependencies,
      decisionsMarkdown,
      understandSummary: (understandDoc?.output as any)?.value_proposition ?? '',
      chosenApproach: (decideDoc?.output as any)?.chosen_approach ?? '',
      mocked: proto.mocked,
      knownIssues: (shipDoc?.output as any)?.knownIssues ?? [],
      nextSteps: (shipDoc?.output as any)?.nextSteps ?? [],
    });
  }
}
