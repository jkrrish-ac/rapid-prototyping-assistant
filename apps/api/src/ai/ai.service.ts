import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiConversationMessage, AiStageResponse } from './ai.types';
import { AiModel } from '../common/lifecycle/stage.types';

const RESPONSE_CONTRACT = `
Respond with ONLY a single JSON object — no prose outside it, no markdown code
fences — matching exactly this shape:

{
  "assistant_message": string,   // what you'd say to the user this turn
  "output": { ... },             // the stage's required output fields (partial is fine across turns; merge, don't drop earlier fields)
  "decisions": [                 // zero or more NEW decisions to append to the log this turn
    {
      "decision": string,        // one clear sentence: what was decided
      "context": string,         // why this decision was needed
      "options": string,         // alternatives considered
      "rationale": string,       // why this option over the others
      "impact": string           // what this affects downstream
    }
  ],
  "ready_to_advance": boolean,   // true once every required output field is populated and the minimum decisions for this stage are logged
  "choices": [                   // zero or more concrete options the USER can pick with a single click instead of typing a reply
    {
      "id": string,               // short stable slug, e.g. "approach-a"
      "label": string,            // a few words, shown on the button itself
      "detail": string            // optional: one clause of nuance shown under the label
    }
  ]
}

Never invent decisions you haven't reasoned through, and never pad "decisions"
just to satisfy a minimum count. Only include a field in "output" once you
actually have a confident answer for it. If output includes an
"architectureLocked" or "escalateToOpus" boolean per this stage's
instructions, set it explicitly (true/false), don't omit it.

About "choices": this platform is select-first, not type-first. Whenever you
are about to ask the user an open-ended question, stop and instead do your
own best analysis using the project context you already have, then turn the
remaining decision into 2-5 concrete, mutually distinct choices so the user
can click one rather than write a paragraph. Only fall back to a plain
open-ended question (with an empty "choices" array) when the answer genuinely
cannot be reduced to a short list of options (e.g. "what's your product
called"). Selecting a choice is exactly equivalent to the user typing its
label as a message — treat it that way in your next turn.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('anthropic.apiKey');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY is not set — AI-powered lifecycle stages will fail until it is configured in .env.',
      );
    }
  }

  private modelFor(model: AiModel): string {
    return model === 'opus'
      ? this.config.get<string>('anthropic.modelOpus')!
      : this.config.get<string>('anthropic.modelSonnet')!;
  }

  /**
   * Runs one turn of a lifecycle stage: the stage's system prompt + shared
   * response contract as the system message, full prior context + this
   * turn's conversation as messages, routed to the model the stage (or its
   * current DESIGN phase) requires.
   */
  async runStageTurn(params: {
    model: AiModel;
    stageSystemPrompt: string;
    projectContext: string;
    conversation: AiConversationMessage[];
    /** The calling stage's own token budget (see StageDefinition.maxOutputTokens). Falls back to 8000. */
    maxTokens?: number;
  }): Promise<AiStageResponse> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not configured on the server. Set it in .env and restart the API.',
      );
    }

    const system = [
      'You are the AI engine behind the Rapid Prototype Assistant, guiding a user through one stage of a structured 12-stage product lifecycle. Be opinionated and fast: name tradeoffs, flag scope creep, and build/decide rather than hedge.',
      params.stageSystemPrompt,
      RESPONSE_CONTRACT,
      `--- PROJECT CONTEXT (prior stage outputs and decision log) ---\n${params.projectContext}`,
    ].join('\n\n');

    const modelId = this.modelFor(params.model);
    const override = this.config.get<number>('anthropic.maxTokensOverride');
    const maxTokens = override ?? params.maxTokens ?? 8000;

    const response = await this.client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system,
      messages: params.conversation.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '';

    if (response.stop_reason === 'max_tokens') {
      this.logger.error(
        `Stage response hit the ${maxTokens}-token output limit before finishing (raw text length: ${raw.length} chars). Tail: ${raw.slice(-300)}`,
      );
      throw new ServiceUnavailableException(
        `The AI's response was cut off because it hit the ${maxTokens}-token output limit for this stage before finishing — this happens on stages that generate a lot of code or detail (BUILD and FIX especially). Raise this stage's maxOutputTokens in stage-definitions.ts, or set ANTHROPIC_MAX_TOKENS in .env to raise every stage at once, then restart the API and try again. If your account's model instead rejects a higher value with an "max_tokens too large" error, lower ANTHROPIC_MAX_TOKENS to whatever ceiling it reports.`,
      );
    }

    return this.parseJsonResponse(raw);
  }

  private parseJsonResponse(raw: string): AiStageResponse {
    const jsonText = this.extractJson(raw);
    try {
      const parsed = JSON.parse(jsonText);
      return {
        assistant_message: parsed.assistant_message ?? '',
        output: parsed.output ?? {},
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        ready_to_advance: Boolean(parsed.ready_to_advance),
        choices: Array.isArray(parsed.choices) ? parsed.choices : [],
      };
    } catch (err) {
      this.logger.error(
        `Failed to parse model JSON response (length ${raw.length}). Head: ${raw.slice(0, 500)} ... Tail: ${raw.slice(-300)}`,
      );
      throw new ServiceUnavailableException(
        'The AI model returned a response that could not be parsed as JSON. Try again.',
      );
    }
  }

  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) return fenced[1];
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
    return trimmed;
  }
}
