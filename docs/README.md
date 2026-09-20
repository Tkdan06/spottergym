# Spotter documentation

This directory is the versioned project memory for developers and AI agents. It is deliberately kept in Git beside the code so that a checkout always contains the map needed to work safely.

## Read in this order

1. [`../AGENTS.md`](../AGENTS.md) — mandatory working agreement and non-negotiable product rules.
2. [`PROJECT_MAP.md`](PROJECT_MAP.md) — where the implementation lives.
3. The domain document related to the task:
   - [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) — product purpose, loops, audience and deliberate non-goals.
   - [`DOMAIN_RULES.md`](DOMAIN_RULES.md) — product semantics, privacy, social, workouts, AI.
   - [`UI_KIT.md`](UI_KIT.md) — visual system and reusable UI primitives.
   - [`OPERATIONS.md`](OPERATIONS.md) — local development, database seed, deployment.
   - [`analytics/`](analytics/) — current analytics audit and phase reports.
4. [`adr/`](adr/) — durable architecture decisions.

## Documentation contract

Documentation explains intent and navigation; it must not pretend to be a second implementation. Code, Prisma schema, migrations, and tests are the technical source of truth.

Update a document in the same pull request or commit when a change affects one of these:

- a product invariant or privacy rule;
- an API/data contract or database model;
- a significant route, service boundary, or deployment procedure;
- a reusable UI convention or design token;
- a decision with viable alternatives and meaningful future cost.

Do not update documentation for a local refactor that changes no public behavior or durable decision.

## Obsidian

Obsidian is optional and is only a reader/editor for these Markdown files. To use it, choose **Open folder as vault** and select the repository root. Do not keep project-critical notes solely in a private Obsidian vault; commit them here instead.
