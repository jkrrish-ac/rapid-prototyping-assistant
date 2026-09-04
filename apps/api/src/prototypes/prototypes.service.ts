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

interface RawPrototypeFile {
  path: string;
  content: string;
}

/**
 * The AI's JSON contract says "array of plain strings" for mocked/
 * dependencies, but models occasionally attach structure anyway (e.g.
 * `[{ package: 'none', reason: '...' }]` instead of `["none — ..."]`),
 * which used to blow up as a Mongoose CastError against this schema's
 * `[String]` field. Coerce defensively instead of trusting the shape.
 */
function toStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'number' || typeof item === 'boolean') return String(item);
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = obj.package ?? obj.name ?? obj.dependency ?? obj.title ?? obj.item;
        const reason = obj.reason ?? obj.why ?? obj.description ?? obj.note;
        if (name && reason) return `${name} — ${reason}`;
        if (name) return String(name);
        return JSON.stringify(item);
      }
      return String(item);
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Same defensive coercion for the files array — path/content must both end up as strings. */
function toFileList(value: unknown): RawPrototypeFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      path: String(f.path ?? ''),
      content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content ?? ''),
    }))
    .filter((f) => f.path.length > 0);
}

/**
 * Merges newly-produced files into the existing set by path instead of
 * replacing the array outright. FIX's prompt deliberately asks for only the
 * files that changed — a full replace would silently delete every untouched
 * file from the saved prototype on the very next FIX turn after BUILD.
 */
function mergeFiles(existing: RawPrototypeFile[], incoming: RawPrototypeFile[]): RawPrototypeFile[] {
  if (incoming.length === 0) return existing;
  const byPath = new Map(existing.map((f) => [f.path, f]));
  for (const f of incoming) byPath.set(f.path, f);
  return Array.from(byPath.values());
}

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

  /**
   * Passthrough to BundlerService.validateFiles for callers outside this
   * module (StagesService, right after BUILD/FIX generate code) — coerces
   * whatever shape the AI returned first, same as saveVersion does.
   */
  async validateFiles(files: unknown): Promise<{ ok: boolean; errors: { path: string; message: string }[] }> {
    return this.bundler.validateFiles(toFileList(files));
  }

  /**
   * Current best-known prototype file contents (self-healing via
   * syncFromStageOutputs) for callers that need the actual code, not just
   * metadata — e.g. StagesService's "repair the saved prototype right now"
   * action, which needs something to feed back into an AI repair turn.
   */
  async getRawFiles(projectId: string): Promise<{ path: string; content: string }[]> {
    const proto = await this.syncFromStageOutputs(projectId);
    if (!proto) return [];
    return (proto.files as unknown as RawPrototypeFile[]).map((f) => ({ path: f.path, content: f.content }));
  }

  async saveVersion(
    projectId: string,
    data: { files: unknown; mocked: unknown; dependencies: unknown },
  ) {
    const files = toFileList(data.files);
    const mocked = toStringList(data.mocked);
    const dependencies = toStringList(data.dependencies);

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
      // Merge by path rather than replace outright — FIX intentionally sends
      // only the files it changed, not the full set.
      existing.files = mergeFiles(existing.files as any, files) as any;
      // Don't let a turn that's silent on mocked/dependencies (FIX usually
      // is) wipe out what BUILD already recorded.
      if (mocked.length) existing.mocked = mocked;
      if (dependencies.length) existing.dependencies = dependencies;
      await existing.save();
      return existing;
    }

    return this.prototypeModel.create({
      project: new Types.ObjectId(projectId),
      framework,
      version: 1,
      files,
      mocked,
      dependencies,
    });
  }

  /**
   * The Prototype collection is normally kept in sync by saveVersion()
   * during BUILD/FIX turns, but a turn can succeed at persisting the
   * stage's own output while still failing to reach saveVersion (network
   * hiccup, an old bug like the dependencies CastError this fixed, or the
   * user advancing past BUILD before a retry happened) — leaving the stage
   * conversation looking complete with no Prototype row to show for it.
   * Every read path re-derives the "should exist" state directly from the
   * BUILD/FIX stage documents (the real source of truth) and backfills or
   * tops up the Prototype row if it's missing or behind, rather than trusting
   * that every past write actually landed.
   */
  private async syncFromStageOutputs(projectId: string): Promise<PrototypeDocument | null> {
    const objId = new Types.ObjectId(projectId);
    const [buildDoc, fixDoc, decideDoc, proto] = await Promise.all([
      this.stageModel.findOne({ project: objId, stage: LifecycleStage.BUILD }),
      this.stageModel.findOne({ project: objId, stage: LifecycleStage.FIX }),
      this.stageModel.findOne({ project: objId, stage: LifecycleStage.DECIDE }),
      this.prototypeModel.findOne({ project: objId }),
    ]);

    const buildFiles = toFileList(buildDoc?.output?.files);
    if (buildFiles.length === 0 && !proto) return null; // BUILD genuinely hasn't produced anything yet

    const fixFiles = toFileList(fixDoc?.output?.files);
    const existingFiles = proto ? (proto.files as unknown as RawPrototypeFile[]) : [];
    const files = mergeFiles(mergeFiles(existingFiles, buildFiles), fixFiles);

    const fixMocked = toStringList(fixDoc?.output?.mocked);
    const buildMocked = toStringList(buildDoc?.output?.mocked);
    const mocked = fixMocked.length ? fixMocked : buildMocked.length ? buildMocked : proto?.mocked ?? [];

    const fixDeps = toStringList(fixDoc?.output?.dependencies);
    const buildDeps = toStringList(buildDoc?.output?.dependencies);
    const dependencies = fixDeps.length ? fixDeps : buildDeps.length ? buildDeps : proto?.dependencies ?? [];

    const techStack = (decideDoc?.output as any)?.tech_stack;
    const framework: 'react' | 'vue' =
      typeof techStack?.framework === 'string' && techStack.framework.toLowerCase() === 'vue'
        ? 'vue'
        : 'react';

    if (!proto) {
      return this.prototypeModel.create({ project: objId, framework, version: 1, files, mocked, dependencies });
    }

    const behind =
      files.length !== proto.files.length ||
      mocked.length !== proto.mocked.length ||
      dependencies.length !== proto.dependencies.length ||
      proto.framework !== framework;
    if (behind) {
      proto.framework = framework;
      proto.files = files as any;
      proto.mocked = mocked;
      proto.dependencies = dependencies;
      await proto.save();
    }
    return proto;
  }

  async getMetadata(projectId: string, userId: string) {
    await this.projects.findOwned(projectId, userId);
    const proto = await this.syncFromStageOutputs(projectId);
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
    const proto = await this.syncFromStageOutputs(projectId);
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
    const proto = await this.syncFromStageOutputs(projectId);
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
