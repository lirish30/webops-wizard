# ADR 0008: AI Outputs Must Be Evidence-Bound And Validated

## Context

The product promise depends on trust. The PRD explicitly states that deterministic logic must come before AI explanation, and that no recommendation or narrative should appear without confidence and caveats. AI is intended for synthesis, explanation, and draft generation, not unsupported decision making.

## Decision

Adopt an AI output validation strategy where generated outputs are constrained by structured inputs, validated against a typed schema, and stored with claim-to-evidence linkage, confidence metadata, and human editability.

## Consequences

Positive:

- Keeps AI features aligned with the product principle of trust before intelligence.
- Reduces hallucination risk in recommendations, reports, and anomaly explanations.
- Makes AI outputs reviewable, auditable, and easier to improve over time.
- Supports progressive rollout of AI features without weakening deterministic detection.

Negative:

- More engineering work than simply prompting a model and rendering the output.
- Some useful but weakly supported narrative may be suppressed or downgraded.
- Schema design and validation logic must evolve with the product’s evidence model.

## Alternatives Considered

### Free-form AI generation with light moderation

Rejected because it conflicts with the product requirement that claims be traceable to evidence and caveated when trust is low.

### No AI layer in early architecture

Rejected because the platform roadmap clearly includes AI-assisted synthesis, and the architecture should prepare for it even if feature rollout is phased.

## Follow-Up Work

- Define typed AI output schemas for summaries, recommendations, and reports.
- Design evidence packaging and claim-link structures.
- Add validation rules that reject unsupported numeric claims and label low-confidence outputs clearly.
