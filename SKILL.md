---
name: faultline
description: Use when a user asks what breaks if a service or dependency goes down, wants an interactive failure map of a repository, or needs source-linked outage scenarios for architecture review or onboarding.
license: MIT
---

# Faultline

Turn a repository into an offline failure rehearsal: take a component down, trace the modeled effect on user journeys, and inspect why. The artifact is a dependency model, not a health check.

## Build the model

Work in the requested repository and scope. If no flow is named, choose one central user journey from the available source and state that scope. Keep outputs outside the source tree unless the user requests otherwise.

Read the entrypoint, its dependencies, error propagation and actual fallback paths. An awaited call without a local catch may still have a resilient adapter: inspect that adapter before equating a provider outage with a rejected call. A name such as “inventory” does not establish a database implementation.

Create a JSON model using [references/model.md](references/model.md). A small complete flow is more useful than an unreadable whole-system graph. Group components into left-to-right layers; edges point **caller → dependency**.

| Edge mode | Use when |
| --- | --- |
| `required` | Inspected code supports caller failure when this dependency is unavailable. Cite the call and relevant error path. |
| `optional` | Inspected code has a fallback that preserves the main operation. Cite that fallback and say what is lost. |
| `unknown` | The relationship or outage consequence is unresolved. State the specific question; do not manufacture a source reference. |

Use only repository-relative source paths with exact line ranges. Evidence validates a location, not an interpretation. Record missing adapters, configuration, capacity, retries and recovery behavior in `limitations` when they matter to this flow. Do not infer SLOs or real-time availability from reachability.

## Render and check

Find this skill's installed directory as `SKILL_DIR`; use that absolute directory for scripts. Node.js 22+ is required. No package installation is needed for rendering.

```bash
node "SKILL_DIR/scripts/faultline.mjs" check model.json --source /path/to/repository
node "SKILL_DIR/scripts/faultline.mjs" render model.json --source /path/to/repository --out /path/to/new-map.html
```

Use actual paths in place of the examples. Existing outputs are preserved; choose a new output name. The renderer never executes the inspected repository. Do not run its setup scripts, connect to services or inject real failures just to make the map.

Open the HTML when a browser is available. Check a required failure, an optional fallback and an unknown case **if present**, a combination, and Restore all. Use keyboard controls and inspect a narrow viewport. If a browser is unavailable, report that visual verification was not performed.

Return the HTML and editable model paths, the modeled scope, actual checks and unresolved questions. Keep the result local unless publishing is explicitly requested. HTML includes dependency names, explanations and source paths: review those before sharing.
