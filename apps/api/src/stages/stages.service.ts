import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StageState, StageDocument } from './stage.schema';
import { LifecycleStage, STAGE_ORDER, AiModel } from '../common/lifecycle/stage.types';
import { STAGE_DEFINITIONS } from '../common/lifecycle/stage-definitions';
import { ProjectsService } from '../projects/projects.service';
import { DecisionsService } from '../decisions/decisions.service';
import { AiService } from '../ai/ai.service';
import { AiConversationMessage } from '../ai/ai.types';
import { PrototypesService } from '../prototypes/prototypes.service';
import { DecisionDocument } from '../decisions/decision.schema';

// Sent as the sole (synthetic) "user" turn when a stage is auto-kicked-off —
// i.e. the user has not typed anything for this stage yet. It is never
// stored in the visible conversation; only the model's reply is.
const KICKOFF_INSTRUCTION = [
  "The user has just arrived at this stage and hasn't typed a message yet.",
  'Using the project context provided below, do your own first-pass analysis for this stage right now — infer everything you reasonably can from prior stages rather than asking the user to restate it.',
  'Populate as much of "output" as you can confidently support.',
  "Where a real decision needs the user's input, don't just ask an open question — reduce it to 2-5 concrete, mutually distinct \"choices\" so the user can pick one with a click instead of typing. Keep each choice label short; put nuance in \"detail\".",
  'Keep "assistant_message" short — a sentence or two framing what you propose and what you want the user to confirm or pick.',
].join(' ');

// How many automatic AI repair turns to attempt when BUILD/FIX generates code
// that fails syntax validation, before giving up and surfacing it to the user.
const MAX_REPAIR_ATTEMPTS = 2;

interface StageFile {
  path: string;
  content: string;
}

/**
 * FIX's prompt (and now repair turns) deliberately ask the AI to return only
 * the files it changed, not the whole prototype — but `doc.output = {
 * ...doc.output, ...aiResponse.output }` is a shallow merge, so an incoming
 * "files" array would otherwise replace the stage's accumulated file list
 * outright instead of topping it up. PrototypesService.saveVersion already
 * merges by path for the actual Prototype record; this keeps the stage
 * document's own output.files consistent with that, since the repair loop's
 * own re-validation reads it directly.
 */
function mergeStageFiles(existing: StageFile[], incoming: StageFile[]): StageFile[] {
  if (incoming.length === 0) return existing;
  const byPath = new Map(existing.map((f) => [f.path, f]));
  for (const f of incoming) byPath.set(f.path, f);
  return Array.from(byPath.values());
}

@Injectable()
export class StagesService {
  private readonly logger = new Logger(StagesService.name);

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
   * Runs immediately after BUILD/FIX produce a "files" output: syntax-checks
   * every generated file (via PrototypesService.validateFiles) and, if
   * anything fails to compile, automatically sends the error straight back
   * to the AI as a repair turn instead of letting a broken file surface only
   * later when the user opens Preview. Retries up to MAX_REPAIR_ATTEMPTS
   * times; if it's still broken after that, leaves a clear note in the
   * conversation and marks the stage not ready to advance rather than
   * silently accepting bad code.
   *
   * Mutates `doc` in place (conversation/output/etc.) and saves it itself on
   * every repair turn. Returns the latest assistant message and any
   * decisions logged during repair, so the caller can fold them into the
   * turn's response instead of returning the now-stale pre-repair message.
   */
  private async validateAndRepairFiles(
    projectId: string,
    stage: LifecycleStage,
    doc: StageDocument,
  ): Promise<{ finalAssistantMessage: string | null; extraDecisions: DecisionDocument[] }> {
    const extraDecisions: DecisionDocument[] = [];
    let finalAssistantMessage: string | null = null;

    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      if (!Array.isArray(doc.output.files)) return { finalAssistantMessage, extraDecisions };

      const { ok, errors } = await this.prototypes.validateFiles(doc.output.files);
      if (ok) return { finalAssistantMessage, extraDecisions };

      this.logger.warn(
        `${stage}: generated files failed syntax validation (attempt ${attempt}/${MAX_REPAIR_ATTEMPTS}): ${JSON.stringify(errors)}`,
      );

      const def = STAGE_DEFINITIONS[stage];
      const model = this.resolveModel(stage, doc.output);
      const projectContext = await this.buildProjectContext(projectId, stage);
      const repairInstruction = [
        "Automatic repair turn: the code you just returned doesn't compile — a syntax error, not a design issue.",
        'Fix ONLY the errors listed below. Return JUST the file(s) you changed to fix them in the "files" array — do NOT repeat every file in the prototype, only the ones with the fix. Unchanged files are preserved automatically; repeating them wastes your output budget and is exactly what caused this turn to get cut off before.',
        'Do not repeat other output fields unless they genuinely changed because of this fix — omit anything that\'s still accurate. A one-sentence assistant_message is enough; do not explain the fix at length.',
        'Errors:',
        ...errors.map((e) => `- ${e.path}: ${e.message}`),
      ].join('\n');

      const conversation: AiConversationMessage[] = [
        ...doc.conversation.map((c) => ({ role: c.role, content: c.content })),
        { role: 'user', content: repairInstruction },
      ];

      const previousFiles: StageFile[] = Array.isArray(doc.output.files)
        ? (doc.output.files as StageFile[])
        : [];

      const aiResponse = await this.ai.runStageTurn({
        model,
        stageSystemPrompt: def.systemPrompt,
        projectContext,
        conversation,
        maxTokens: def.maxOutputTokens,
      });

      // The synthetic repair instruction never appears as a user bubble —
      // only the AI's new reply does, same convention as kickoff.
      doc.conversation.push({
        role: 'assistant',
        content: aiResponse.assistant_message,
        createdAt: new Date(),
      } as any);
      doc.output = { ...doc.output, ...aiResponse.output };
      // The repair instruction deliberately asks for only the fixed file(s)
      // — top them up onto the full set rather than letting the shallow
      // merge above replace it with just those few files.
      if (Array.isArray(aiResponse.output.files)) {
        doc.output.files = mergeStageFiles(previousFiles, aiResponse.output.files as StageFile[]);
      }
      doc.lastModelUsed = model;
      doc.readyToAdvance = aiResponse.ready_to_advance;
      doc.pendingChoices = (aiResponse.choices ?? []) as any;
      finalAssistantMessage = aiResponse.assistant_message;

      for (const draft of aiResponse.decisions) {
        extraDecisions.push(await this.decisions.append(projectId, stage, model, draft));
      }
      await doc.save();
    }

    // Still broken after every attempt — don't claim this is ready to ship.
    const stillFiles = Array.isArray(doc.output.files) ? doc.output.files : [];
    const { ok, errors } = await this.prototypes.validateFiles(stillFiles);
    if (!ok) {
      const note = [
        `Heads up: this code still has a syntax error after ${MAX_REPAIR_ATTEMPTS} automatic fix attempts and needs another look:`,
        ...errors.map((e) => `- ${e.path}: ${e.message}`),
        'Send a message (even just "fix it") and I\'ll take another pass.',
      ].join('\n');
      doc.conversation.push({ role: 'assistant', content: note, createdAt: new Date() } as any);
      doc.readyToAdvance = false;
      finalAssistantMessage = note;
      await doc.save();
    }

    return { finalAssistantMessage, extraDecisions };
  }

  /**
   * Shared turn-application logic: runs the given conversation through the
   * AI, persists the resulting output/decisions/pendingChoices, and forwards
   * BUILD/FIX files to PrototypesService. Used by both postMessage (a
   * user-typed turn) and kickoff (an auto-triggered, message-less turn).
   */
  private async applyAiTurn(
    projectId: string,
    stage: LifecycleStage,
    doc: StageDocument,
    conversation: AiConversationMessage[],
    recordUserMessage?: string,
  ) {
    const def = STAGE_DEFINITIONS[stage];
    const model = this.resolveModel(stage, doc.output);
    const projectContext = await this.buildProjectContext(projectId, stage);

    const aiResponse = await this.ai.runStageTurn({
      model,
      stageSystemPrompt: def.systemPrompt,
      projectContext,
      conversation,
      maxTokens: def.maxOutputTokens,
    });

    const previousFiles: StageFile[] = Array.isArray(doc.output.files) ? (doc.output.files as StageFile[]) : [];

    if (recordUserMessage !== undefined) {
      doc.conversation.push({ role: 'user', content: recordUserMessage, createdAt: new Date() } as any);
    }
    doc.conversation.push({
      role: 'assistant',
      content: aiResponse.assistant_message,
      createdAt: new Date(),
    } as any);
    doc.output = { ...doc.output, ...aiResponse.output };
    // BUILD always returns the complete file set (merging it with itself by
    // path is a no-op), but FIX's prompt deliberately asks for only the
    // files that changed — top those up onto the accumulated set instead of
    // letting this shallow merge silently drop every untouched file from the
    // stage's own output.files (PrototypesService.saveVersion does the same
    // merge for the actual Prototype record; this keeps the two consistent).
    if (Array.isArray(aiResponse.output.files)) {
      doc.output.files = mergeStageFiles(previousFiles, aiResponse.output.files as StageFile[]);
    }
    doc.lastModelUsed = model;
    doc.readyToAdvance = aiResponse.ready_to_advance;
    doc.pendingChoices = (aiResponse.choices ?? []) as any;

    const createdDecisions: DecisionDocument[] = [];
    for (const draft of aiResponse.decisions) {
      createdDecisions.push(await this.decisions.append(projectId, stage, model, draft));
    }

    await doc.save();

    let assistantMessage = aiResponse.assistant_message;
    let allDecisions = createdDecisions;

    if ((stage === LifecycleStage.BUILD || stage === LifecycleStage.FIX) && Array.isArray(doc.output.files)) {
      const repair = await this.validateAndRepairFiles(projectId, stage, doc);
      if (repair.finalAssistantMessage) assistantMessage = repair.finalAssistantMessage;
      allDecisions = [...allDecisions, ...repair.extraDecisions];

      // PrototypesService.saveVersion coerces mocked/dependencies/files
      // defensively — the AI's JSON contract asks for plain strings but
      // occasionally attaches structure instead, which used to CastError
      // against the Prototype schema. Save whatever the final state is,
      // even if repair didn't fully succeed, so Preview/Download reflect
      // the AI's best attempt rather than nothing at all.
      await this.prototypes.saveVersion(projectId, {
        files: doc.output.files,
        mocked: doc.output.mocked,
        dependencies: doc.output.dependencies,
      });
    }

    return {
      stage: doc,
      assistantMessage,
      decisionsCreated: allDecisions,
      modelUsed: model,
    };
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

    const conversation: AiConversationMessage[] = [
      ...doc.conversation.map((c) => ({ role: c.role, content: c.content })),
      { role: 'user', content: message },
    ];

    return this.applyAiTurn(projectId, stage, doc, conversation, message);
  }

  /**
   * Auto-triggers the stage's first AI turn with no user-typed message, so
   * the user lands on a stage that already has a proposed analysis and/or
   * clickable choices waiting for them, rather than a blank "type something"
   * box. Safe to call repeatedly — it only actually runs once per stage
   * (before any real conversation exists), and never for IDEA, which stays
   * pure free-text capture of the raw idea.
   */
  async kickoff(projectId: string, userId: string, stage: LifecycleStage) {
    const project = await this.projects.findOwned(projectId, userId);
    if (project.currentStage !== stage) {
      throw new BadRequestException(
        `${stage} is not this project's active stage (currently ${project.currentStage}).`,
      );
    }

    const doc = await this.getOrCreate(projectId, stage);

    if (stage === LifecycleStage.IDEA || doc.status === 'complete' || doc.conversation.length > 0) {
      return {
        stage: doc,
        assistantMessage: '',
        decisionsCreated: [] as DecisionDocument[],
        modelUsed: doc.lastModelUsed,
        skipped: true,
      };
    }

    if (doc.status === 'pending') {
      doc.status = 'active';
      doc.startedAt = new Date();
    }

    const conversation: AiConversationMessage[] = [{ role: 'user', content: KICKOFF_INSTRUCTION }];
    const result = await this.applyAiTurn(projectId, stage, doc, conversation);
    return { ...result, skipped: false };
  }

  /**
   * Lets the user directly edit a stage's structured output from the UI
   * (the AI drafts it, but the user should always be able to correct it
   * without going back through a conversational turn). Replaces the output
   * wholesale with what the client sends — the client is expected to submit
   * the full current output object, not a partial patch, so a field the user
   * cleared actually goes away rather than resurfacing from the old value.
   * Only allowed on the project's current active stage, same as messages.
   */
  async updateOutput(
    projectId: string,
    userId: string,
    stage: LifecycleStage,
    output: Record<string, unknown>,
  ) {
    const project = await this.projects.findOwned(projectId, userId);
    if (project.currentStage !== stage) {
      throw new BadRequestException(
        `${stage} is not this project's active stage (currently ${project.currentStage}). Only the active stage's output can be edited.`,
      );
    }

    // A manual edit is the user's own text, not an AI turn — validate it
    // up front and reject rather than silently save something that won't
    // preview or bundle, same as any other form-level validation.
    if (
      (stage === LifecycleStage.BUILD || stage === LifecycleStage.FIX) &&
      Array.isArray(output.files)
    ) {
      const { ok, errors } = await this.prototypes.validateFiles(output.files);
      if (!ok) {
        throw new BadRequestException(
          `Can't save — this code doesn't compile:\n${errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`,
        );
      }
    }

    const doc = await this.getOrCreate(projectId, stage);
    doc.output = output;
    doc.readyToAdvance = this.outputComplete(stage, doc.output).length === 0 && doc.readyToAdvance;
    await doc.save();

    if ((stage === LifecycleStage.BUILD || stage === LifecycleStage.FIX) && Array.isArray(doc.output.files)) {
      // PrototypesService.saveVersion coerces mocked/dependencies/files
      // defensively — the AI's JSON contract asks for plain strings but
      // occasionally attaches structure instead, which used to CastError
      // against the Prototype schema.
      await this.prototypes.saveVersion(projectId, {
        files: doc.output.files,
        mocked: doc.output.mocked,
        dependencies: doc.output.dependencies,
      });
    }

    return doc;
  }

  /**
   * Repairs the CURRENTLY SAVED prototype on demand, independent of which
   * lifecycle stage the project is officially sitting on. The automatic
   * repair loop in applyAiTurn only fires on a fresh BUILD/FIX turn — if the
   * project has already advanced past BUILD/FIX, or the AI's fix attempts
   * were exhausted earlier, there was previously no way to trigger another
   * repair pass without an active-stage chat message. This bypasses that
   * gate entirely (ownership is still checked) and always runs the repair
   * conversation through the FIX stage's own document — creating it if the
   * project hasn't formally reached FIX yet — since that's conceptually
   * where bug-fixing belongs regardless of the project's lifecycle position.
   */
  async repairPrototypeNow(projectId: string, userId: string) {
    await this.projects.findOwned(projectId, userId);

    const files = await this.prototypes.getRawFiles(projectId);
    if (files.length === 0) {
      throw new BadRequestException('No prototype has been built yet — nothing to repair.');
    }

    const initial = await this.prototypes.validateFiles(files);
    if (initial.ok) {
      return {
        repaired: false,
        alreadyOk: true,
        message: 'The current prototype already compiles cleanly — nothing to repair.',
      };
    }

    const fixDoc = await this.getOrCreate(projectId, LifecycleStage.FIX);
    if (fixDoc.status === 'pending') {
      fixDoc.status = 'active';
      fixDoc.startedAt = new Date();
    }
    fixDoc.output = { ...fixDoc.output, files };
    await fixDoc.save();

    const repair = await this.validateAndRepairFiles(projectId, LifecycleStage.FIX, fixDoc);

    await this.prototypes.saveVersion(projectId, {
      files: fixDoc.output.files,
      mocked: fixDoc.output.mocked,
      dependencies: fixDoc.output.dependencies,
    });

    const final = await this.prototypes.validateFiles(fixDoc.output.files);

    return {
      repaired: final.ok,
      alreadyOk: false,
      message:
        repair.finalAssistantMessage ?? (final.ok ? 'Fixed.' : 'Still broken — see the FIX stage for details.'),
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
