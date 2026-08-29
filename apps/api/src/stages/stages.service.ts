import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StageState, StageDocument } from './stage.schema';
import { LifecycleStage, STAGE_ORDER, AiModel } from '../common/lifecycle/stage.types';
import { STAGE_DEFINITIONS } from '../common/lifecycle/stage-definitions';
import { ProjectsService } from '../projects/projects.service';
import { DecisionsService } from '../decisions/decisions.service';
import { AiService } from '../ai/ai.service';
import { PrototypesService } from '../prototypes/prototypes.service';
import { DecisionDocument } from '../decisions/decision.schema';

@Injectable()
export class StagesService {
  constructor(
    @InjectModel(StageState.name) private stageModel: Model<StageDocument>,
    private projects: ProjectsService,
    private decisions: DecisionsService,
    private ai: AiService,
    private prototypes: PrototypesService,
  ) {}

  async getOrCreate(projectId: string, stage: LifecycleStage): Promise<StageDocument> {
    let doc = await this.stageModel.findOne({
      project: new Types.ObjectId(projectId),
      stage,
    });
    if (!doc) {
      doc = await this.stageModel.create({
        project: new Types.ObjectId(projectId),
        stage,
        status: STAGE_ORDER[0] === stage ? 'active' : 'pending',
        startedAt: STAGE_ORDER[0] === stage ? new Date() : null,
      });
    }
    return doc;
  }

  async listForProject(projectId: string, userId: string) {
    await this.projects.findOwned(projectId, userId); // ownership check
    const docs = await Promise.all(
      STAGE_ORDER.map((s) => this.getOrCreate(projectId, s)),
    );
    return docs;
  }

  async getStage(projectId: string, userId: string, stage: LifecycleStage) {
    await this.projects.findOwned(projectId, userId);
    return this.getOrCreate(projectId, stage);
  }

  /** Resolves which model should handle the NEXT turn of this stage. */
  private resolveModel(stage: LifecycleStage, output: Record<string, unknown>): AiModel {
    const def = STAGE_DEFINITIONS[stage];
    if (def.model !== 'split') return def.model;
    // DESIGN: opus until architecture decisions are locked, then sonnet renders.
    return output.architectureLocked ? 'sonnet' : 'opus';
  }

  private async buildProjectContext(projectId: string, upToStage: LifecycleStage) {
    const stagesUpTo = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(upToStage) + 1);
    const parts: string[] = [];
    for (const s of stagesUpTo) {
      const doc = await this.stageModel.findOne({
        project: new Types.ObjectId(projectId),
        stage: s,
      });
      if (doc && Object.keys(doc.output ?? {}).length > 0) {
        parts.push(`### ${s} output\n${JSON.stringify(doc.output, null, 2)}`);
      }
    }
    const decisions = await this.decisions.list(projectId);
    if (decisions.length) {
      const decisionLines = decisions.map(
        (d) =>
          `${d.decisionId} [${d.status}${d.supersededBy ? ` -> ${d.supersededBy}` : ''}] (${d.stage}/${d.model}): ${d.decision}`,
      );
      parts.push(`### Decision log so far\n${decisionLines.join('\n')}`);
    }
    return parts.join('\n\n') || '(No prior stage output yet — this is the first stage.)';
  }

  /**
   * Sends one user message to the current stage's AI conversation, applies
   * the model's structured response (output merge, decision log entries,
   * BUILD/FIX file hand-off to PrototypesService), and returns the update.
   */
  async postMessage(
    projectId: string,
    userId: string,
    stage: LifecycleStage,
    message: string,
  ) {
    const project = await this.projects.findOwned(projectId, userId);
    if (project.currentStage !== stage) {
      throw new BadRequestException(
        `${stage} is not this project's active stage (currently ${project.currentStage}). You can review completed stages but only the active stage accepts new input.`,
      );
    }

    const doc = await this.getOrCreate(projectId, stage);
    if (doc.status === 'pending') {
      doc.status = 'active';
      doc.startedAt = new Date();
    }

    const def = STAGE_DEFINITIONS[stage];
    const model = this.resolveModel(stage, doc.output);
    const projectContext = await this.buildProjectContext(projectId, stage);

    const conversation = [
      ...doc.conversation.map((c) => ({ role: c.role, content: c.content })),
      { role: 'user' as const, content: message },
    ];

    const aiResponse = await this.ai.runStageTurn({
      model,
      stageSystemPrompt: def.systemPrompt,
      projectContext,
      conversation,
    });

    doc.conversation.push({ role: 'user', content: message, createdAt: new Date() } as any);
    doc.conversation.push({
      role: 'assistant',
      content: aiResponse.assistant_message,
      createdAt: new Date(),
    } as any);
    doc.output = { ...doc.output, ...aiResponse.output };
    doc.lastModelUsed = model;
    doc.readyToAdvance = aiResponse.ready_to_advance;

    const createdDecisions: DecisionDocument[] = [];
    for (const draft of aiResponse.decisions) {
      createdDecisions.push(await this.decisions.append(projectId, stage, model, draft));
    }

    await doc.save();

    if ((stage === LifecycleStage.BUILD || stage === LifecycleStage.FIX) && Array.isArray(doc.output.files)) {
      await this.prototypes.saveVersion(projectId, {
        files: doc.output.files as { path: string; content: string }[],
        mocked: (doc.output.mocked as string[]) ?? [],
        dependencies: (doc.output.dependencies as string[]) ?? [],
      });
    }

    return {
      stage: doc,
      assistantMessage: aiResponse.assistant_message,
      decisionsCreated: createdDecisions,
      modelUsed: model,
    };
  }

  private outputComplete(stage: LifecycleStage, output: Record<string, unknown>): string[] {
    const def = STAGE_DEFINITIONS[stage];
    const missing: string[] = [];
    for (const field of def.requiredOutputFields) {
      const value = output[field];
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (empty) missing.push(field);
    }
    return missing;
  }

  async advance(projectId: string, userId: string, stage: LifecycleStage) {
    const project = await this.projects.findOwned(projectId, userId);
    if (project.currentStage !== stage) {
      throw new BadRequestException(
        `${stage} is not this project's active stage (currently ${project.currentStage}).`,
      );
    }

    const doc = await this.getOrCreate(projectId, stage);
    const missing = this.outputComplete(stage, doc.output);
    if (missing.length) {
      throw new BadRequestException(
        `Cannot advance ${stage}: missing required output field(s): ${missing.join(', ')}.`,
      );
    }

    const def = STAGE_DEFINITIONS[stage];
    const decisionCount = await this.decisions.countForStage(projectId, stage);
    if (decisionCount < def.minDecisions) {
      throw new BadRequestException(
        `Cannot advance ${stage}: at least ${def.minDecisions} logged decision(s) required (found ${decisionCount}). Something was skipped.`,
      );
    }

    doc.status = 'complete';
    doc.completedAt = new Date();
    await doc.save();

    if (stage === LifecycleStage.ITERATE) {
      const target = doc.output.recommendLoopToIdeate
        ? LifecycleStage.IDEATE
        : LifecycleStage.DESIGN;
      const updatedProject = await this.projects.loopBackTo(projectId, userId, target);
      const targetDoc = await this.getOrCreate(projectId, target);
      targetDoc.status = 'active';
      if (!targetDoc.startedAt) targetDoc.startedAt = new Date();
      await targetDoc.save();
      return { project: updatedProject, nextStage: target };
    }

    const updatedProject = await this.projects.advanceToNextStage(projectId, userId);
    const nextDoc = await this.getOrCreate(projectId, updatedProject.currentStage);
    if (nextDoc.status === 'pending') {
      nextDoc.status = 'active';
      nextDoc.startedAt = new Date();
      await nextDoc.save();
    }
    return { project: updatedProject, nextStage: updatedProject.currentStage };
  }
}
