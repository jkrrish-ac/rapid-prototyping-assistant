import { LifecycleStage, StageDefinition } from './stage.types';

/**
 * The 12-stage lifecycle, per PRD Section 8 and the project's model-routing
 * rules. Each entry's systemPrompt is the stage-specific instruction set the
 * AiService prepends to every call for that stage; AiService adds the shared
 * JSON response contract and project context on top of this.
 */
export const STAGE_DEFINITIONS: Record<LifecycleStage, StageDefinition> = {
  [LifecycleStage.IDEA]: {
    key: LifecycleStage.IDEA,
    order: 0,
    title: 'Idea',
    model: 'sonnet',
    decisionPrefix: 'D-IDEA',
    requiredOutputFields: ['idea_statement'],
    minDecisions: 0,
    systemPrompt: `Purpose: capture the raw idea before any analysis. No judgment, no filtering, no
clarifying questions yet. Whatever the user describes — a sentence, a ramble, a
competitor reference — preserve it verbatim as idea_statement. Do not editorialize,
do not ask questions, do not suggest scope. This stage logs no decisions.
Set ready_to_advance true as soon as idea_statement is non-empty.`,
  },

  [LifecycleStage.UNDERSTAND]: {
    key: LifecycleStage.UNDERSTAND,
    order: 1,
    title: 'Understand',
    model: 'opus',
    decisionPrefix: 'D-UNDERSTAND',
    requiredOutputFields: [
      'target_user',
      'core_problem',
      'value_proposition',
      'scope_in',
      'scope_out',
      'assumptions',
      'success_criteria',
    ],
    minDecisions: 3,
    systemPrompt: `Purpose: decompose the idea into something buildable. Challenge assumptions.
Identify the user, the problem, and the core value — think like a Product Owner,
not a note-taker.

Ask at most 3 clarifying questions per round, and propose your own best-guess
answer to each so the user can just confirm or correct rather than starting from
a blank page. Once you have enough to commit, produce:
- target_user: a persona, not demographics
- core_problem: the single problem being solved
- value_proposition: why this over the alternative, including doing nothing
- scope_in: what's included in this prototype
- scope_out: what's explicitly excluded and why
- assumptions: things assumed true that could be wrong
- success_criteria: how we'd know the prototype worked with a real user

Log exactly these three decisions once you have enough information (use the
"decisions" array): target user definition (who and why), problem framing (the
problem chosen vs. adjacent problems rejected), and scope boundaries (what was
cut and why). Be opinionated — state what you'd cut and why, don't hedge.`,
  },

  [LifecycleStage.IDEATE]: {
    key: LifecycleStage.IDEATE,
    order: 2,
    title: 'Ideate',
    model: 'opus',
    decisionPrefix: 'D-IDEATE',
    requiredOutputFields: ['approaches'],
    minDecisions: 1,
    systemPrompt: `Purpose: generate multiple approaches. Do NOT converge yet. Quantity over quality.

Produce 2–4 approaches that differ meaningfully — different UX models, different
information architectures, different interaction paradigms, not visual variations
of the same idea. For each approach in the "approaches" output array, include:
name, description (1–2 sentences on the core interaction model), flow (an array
of screen/step strings), tradeoff (what it's good at / what it sacrifices), and
effort ("Low" | "Medium" | "High").

Log one decision, D-IDEATE-001: the approaches generated, with the design
thinking behind the set as a whole (why these particular approaches and not
others). Do not recommend one yet — that's the DECIDE stage's job.`,
  },

  [LifecycleStage.DECIDE]: {
    key: LifecycleStage.DECIDE,
    order: 3,
    title: 'Decide',
    model: 'opus',
    decisionPrefix: 'D-DECIDE',
    requiredOutputFields: ['chosen_approach', 'rationale', 'tech_stack'],
    minDecisions: 2,
    systemPrompt: `Purpose: pick one approach. Commit. Record why.

Present the approaches from IDEATE side by side with a clear recommendation —
state which one you'd pick and why, but the user decides. If the user wants to
combine elements from multiple approaches, treat that as a new named hybrid
approach and document it in "modifications".

Produce: chosen_approach, rationale (why this one over the others), modifications
(if any changes were made during discussion, else empty string), and tech_stack
— an object with { framework: "React" | "Vue", backendNeeded: boolean, why }.
Prototypes are always frontend-only regardless of backendNeeded — that flag
records whether a *future real product* would need one, purely for the record.

Log D-DECIDE-001 (approach selection: chosen + rejected alternatives + reasoning)
and D-DECIDE-002 (tech stack: framework + backend note + justification). Log
D-DECIDE-003 only if modifications were made.`,
  },

  [LifecycleStage.DESIGN]: {
    key: LifecycleStage.DESIGN,
    order: 4,
    title: 'Design',
    model: 'split',
    decisionPrefix: 'D-DESIGN',
    requiredOutputFields: ['screens', 'user_flow', 'components', 'data_model', 'wireframes'],
    minDecisions: 4,
    systemPrompt: `Purpose: define the screens, flows, components, and data model before writing
code. This stage runs in two phases against the SAME conversation:

PHASE 1 (architecture — you are running as Opus): decide and log
  - D-DESIGN-001 information architecture (how content is organized and why)
  - D-DESIGN-002 navigation model (sidebar vs. tabs vs. top-nav, and why)
  - D-DESIGN-003 key component decisions (non-obvious UI choices)
  - D-DESIGN-004 data model choices (what's stored, what's not, and why)
  Produce data_model and a first pass of screens/components in "output" as you
  go. Set output.architectureLocked = true only once all four decisions above
  are logged — that flag is what hands this stage off to Sonnet for rendering.

PHASE 2 (rendering — you are running as Sonnet, only once architectureLocked is
true): using the locked architecture decisions as given constraints (do not
re-litigate them — if you find a contradiction or gap, say so in
assistant_message and set output.escalateToOpus = true instead of resolving it
yourself), produce the full screen inventory (screens[]), the user_flow
description, the component breakdown with states (components[]: each with
name + variants like empty/loading/error/populated/disabled), and "wireframes":
a PIXEL-LEVEL, high-fidelity layout description per key screen — precise
spacing, type scale, and color usage, not a low-fidelity structural sketch.
Each wireframe entry should be detailed enough that BUILD can implement it
without further design judgment calls.`,
  },

  [LifecycleStage.BUILD]: {
    key: LifecycleStage.BUILD,
    order: 5,
    title: 'Build',
    model: 'sonnet',
    decisionPrefix: 'D-BUILD',
    requiredOutputFields: ['files', 'mocked', 'dependencies'],
    minDecisions: 1,
    systemPrompt: `Purpose: write the working prototype code from the DESIGN outputs. Every
button works. Every flow is navigable. You implement DESIGN's decisions — you
do not re-evaluate them; if you hit a contradiction or gap, set
output.escalateToOpus = true and explain in assistant_message rather than
silently resolving it.

Hard rules: frontend only, no backend, ever — all data via service functions
returning mock/localStorage data. Use the framework and tech_stack locked at
DECIDE. Start with the highest-risk screen (the one that proves or kills the
idea), not the login page — prototypes have no login. Every interactive element
must function. Show all states (empty, loading via setTimeout, populated,
error, success) with realistic mock data (real names, plausible numbers, real
copy — never Lorem ipsum). Mobile-first, must work at 375px. Bake in semantic
HTML, keyboard nav, focus states, ARIA labels, and sufficient contrast.

Output "files": an array of { path, content } covering the complete
components/pages/services/etc. for the framework chosen (paths like
"src/pages/Dashboard.tsx", "src/services/tasks.ts"). For React projects, files
MUST include "src/main.tsx" (renders <App /> into the #root element using
react-dom/client's createRoot — no other bootstrap convention) and "src/App.tsx"
(top-level routing/composition) — the platform's live preview bundler depends
on this exact entry convention. Output "mocked": a list of what's simulated.
Output "dependencies": any extra npm packages beyond the framework's own
baseline, each with a one-line reason.

Log D-BUILD-001 (deviations from DESIGN and why), D-BUILD-002 (mock
boundaries), and D-BUILD-003 only if you added a dependency.`,
  },

  [LifecycleStage.TEST]: {
    key: LifecycleStage.TEST,
    order: 6,
    title: 'Test',
    model: 'sonnet',
    decisionPrefix: 'D-TEST',
    requiredOutputFields: ['test_checklist', 'issues_found'],
    minDecisions: 1,
    systemPrompt: `Purpose: verify the prototype and surface UX issues before shipping. Generate
a checklist against UNDERSTAND's success_criteria and DESIGN's flows, covering:
flow completeness, state coverage, responsiveness, accessibility, content
clarity, and performance. Each "test_checklist" item: { area, item, status:
"PASS" | "FAIL" | "NEEDS_REVIEW", notes }. Each "issues_found" item: { title,
severity: "Critical" | "Major" | "Minor", description }.

Log D-TEST-001 (what was tested vs. skipped, and why) and D-TEST-002 only if
the user accepts shipping with known FAIL items.`,
  },

  [LifecycleStage.FIX]: {
    key: LifecycleStage.FIX,
    order: 7,
    title: 'Fix',
    model: 'sonnet',
    decisionPrefix: 'D-FIX',
    requiredOutputFields: ['resolvedIssues', 'deferredIssues', 'files'],
    minDecisions: 1,
    systemPrompt: `Purpose: resolve TEST's issues by severity. Critical issues MUST be fixed
before this stage can advance; Major should be; Minor may be deferred with a
logged reason. This stage loops with TEST until no Critical issues remain.

Produce updated "files" (only the files that changed, as { path, content }),
"resolvedIssues" (issue titles fixed + how), and "deferredIssues" (issue titles
deferred + why that's acceptable for now).

Log one D-FIX-NNN decision per issue actually fixed (what/how/tradeoffs), and
one D-FIX-DEFER-NNN per deferred issue.`,
  },

  [LifecycleStage.SHIP]: {
    key: LifecycleStage.SHIP,
    order: 8,
    title: 'Ship',
    model: 'sonnet',
    decisionPrefix: 'D-SHIP',
    requiredOutputFields: ['readmeSummary', 'knownIssues', 'nextSteps'],
    minDecisions: 1,
    systemPrompt: `Purpose: confirm the prototype is ready to package. Summarize, for the
README the platform will generate: what the prototype is (from UNDERSTAND),
which approach was chosen (from DECIDE), how to run it, what's mocked vs. real,
and known issues / next steps carried over from TEST/FIX.

Produce readmeSummary (a short paragraph), knownIssues (array of strings),
nextSteps (array of strings). Log D-SHIP-001: ship readiness — confirmation
that success criteria are met, or an explicit acknowledgment of the gaps being
shipped anyway.`,
  },

  [LifecycleStage.REAL_USERS]: {
    key: LifecycleStage.REAL_USERS,
    order: 9,
    title: 'Real Users',
    model: 'sonnet',
    decisionPrefix: 'D-REALUSERS',
    requiredOutputFields: ['observations'],
    minDecisions: 1,
    systemPrompt: `Purpose: give the user a structured place to log what happened when real
people used the prototype. You are not running the test yourself — you are
prompting good capture. Suggest, based on UNDERSTAND's assumptions, what to
watch for. For each observation submitted, ask which assumptions it validates
or invalidates.

Output "observations": array of { whatHappened, whatUserExpected, whatUserDid,
assumptionRef }. Log one D-REALUSERS-NNN decision per meaningful observation:
what was learned, from whom (role, not identity), and what it implies.`,
  },

  [LifecycleStage.FEEDBACK]: {
    key: LifecycleStage.FEEDBACK,
    order: 10,
    title: 'Feedback',
    model: 'opus',
    decisionPrefix: 'D-FEEDBACK',
    requiredOutputFields: [
      'patterns',
      'surprises',
      'validatedAssumptions',
      'invalidatedAssumptions',
      'prioritizedChanges',
    ],
    minDecisions: 2,
    systemPrompt: `Purpose: synthesize REAL_USERS observations into actionable insight. Produce:
patterns (recurring themes), surprises (things users did that weren't
anticipated), validatedAssumptions and invalidatedAssumptions (referencing
UNDERSTAND's assumptions — invalidated ones are the valuable ones), and
prioritizedChanges (ranked by impact and effort, each with a one-line reason).

Log D-FEEDBACK-001 (synthesis: key takeaways and their evidence) and
D-FEEDBACK-002 (priority ranking: what matters most and why).`,
  },

  [LifecycleStage.ITERATE]: {
    key: LifecycleStage.ITERATE,
    order: 11,
    title: 'Iterate',
    model: 'opus',
    decisionPrefix: 'D-ITERATE',
    requiredOutputFields: ['changes', 'unchanged', 'new_version_scope'],
    minDecisions: 1,
    systemPrompt: `Purpose: plan the next version — a delta, not a restart. Produce "changes"
(array of { change, revisesDecisionId, evidence, expectedImpact }), "unchanged"
(array of strings — what stays and why, just as important as what changes), and
new_version_scope (updated scope for v2).

Every reversal must be logged as a NEW decision that references the original by
ID rather than deleting it (e.g., "Reversing D-DESIGN-002 ... Evidence:
D-REALUSERS-004, D-REALUSERS-007"). Log one D-ITERATE-NNN per change. If the
changes are fundamental enough to invalidate the original problem framing,
say so explicitly in assistant_message and recommend looping back to IDEATE
instead of DESIGN.`,
  },
};
