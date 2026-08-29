import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Decision, DecisionDocument } from './decision.schema';
import { LifecycleStage } from '../common/lifecycle/stage.types';
import { STAGE_DEFINITIONS } from '../common/lifecycle/stage-definitions';
import { AiDecisionDraft } from '../ai/ai.types';

@Injectable()
export class DecisionsService {
  constructor(
    @InjectModel(Decision.name) private decisionModel: Model<DecisionDocument>,
  ) {}

  async list(projectId: string) {
    return this.decisionModel
      .find({ project: new Types.ObjectId(projectId) })
      .sort({ timestamp: 1 })
      .exec();
  }

  async listForStage(projectId: string, stage: LifecycleStage) {
    return this.decisionModel
      .find({ project: new Types.ObjectId(projectId), stage })
      .sort({ timestamp: 1 })
      .exec();
  }

  /** Total decisions ever logged for this stage, active or superseded — used for the minDecisions gate. */
  async countForStage(projectId: string, stage: LifecycleStage) {
    return this.decisionModel.countDocuments({
      project: new Types.ObjectId(projectId),
      stage,
    });
  }

  /** Appends one new decision, auto-numbering it within its stage prefix. */
  async append(
    projectId: string,
    stage: LifecycleStage,
    model: 'opus' | 'sonnet',
    draft: AiDecisionDraft,
  ) {
    const prefix = STAGE_DEFINITIONS[stage].decisionPrefix;
    const existingCount = await this.decisionModel.countDocuments({
      project: new Types.ObjectId(projectId),
      decisionId: { $regex: `^${prefix}-` },
    });
    const nextNumber = String(existingCount + 1).padStart(3, '0');
    const decisionId = `${prefix}-${nextNumber}`;

    return this.decisionModel.create({
      project: new Types.ObjectId(projectId),
      decisionId,
      stage,
      model,
      decision: draft.decision,
      context: draft.context,
      options: draft.options,
      rationale: draft.rationale,
      impact: draft.impact,
      status: 'ACTIVE',
    });
  }

  /**
   * Supersedes an existing decision with a new one (typically logged during
   * ITERATE). The original is never deleted — only marked SUPERSEDED.
   */
  async supersede(
    projectId: string,
    originalDecisionId: string,
    newDecision: {
      stage: LifecycleStage;
      model: 'opus' | 'sonnet';
      draft: AiDecisionDraft;
    },
  ) {
    const original = await this.decisionModel.findOne({
      project: new Types.ObjectId(projectId),
      decisionId: originalDecisionId,
    });
    if (!original) {
      throw new NotFoundException(`Decision ${originalDecisionId} not found.`);
    }
    if (original.status === 'SUPERSEDED') {
      throw new BadRequestException(
        `${originalDecisionId} is already superseded by ${original.supersededBy}.`,
      );
    }

    const created = await this.append(
      projectId,
      newDecision.stage,
      newDecision.model,
      {
        ...newDecision.draft,
        decision: `${newDecision.draft.decision} (Reverses ${originalDecisionId}.)`,
      },
    );

    original.status = 'SUPERSEDED';
    original.supersededBy = created.decisionId;
    await original.save();

    return { original, created };
  }

  /** Renders the full log as the DECISIONS.md shipped with every download. */
  async renderMarkdown(projectId: string, projectName: string) {
    const decisions = await this.list(projectId);
    const lines = [`# Decision Log — ${projectName}`, ''];
    for (const d of decisions) {
      lines.push(`## ${d.decisionId}`);
      lines.push(`- **Stage:** ${d.stage}`);
      lines.push(`- **Model:** ${d.model}`);
      lines.push(`- **Timestamp:** ${d.timestamp?.toISOString?.() ?? ''}`);
      lines.push(`- **Decision:** ${d.decision}`);
      lines.push(`- **Context:** ${d.context}`);
      lines.push(`- **Options considered:** ${d.options}`);
      lines.push(`- **Rationale:** ${d.rationale}`);
      lines.push(`- **Impact:** ${d.impact}`);
      lines.push(
        `- **Status:** ${d.status}${d.supersededBy ? ` by ${d.supersededBy}` : ''}`,
      );
      lines.push('');
    }
    return lines.join('\n');
  }
}
