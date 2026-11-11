# Model format · version 1

See [the complete checkout model](../examples/checkout.model.json) and its [source fixture](../examples/checkout/app.mjs). Do not copy its source references into an unrelated project.

The renderer accepts a JSON object:

| Field | Contract |
| --- | --- |
| `version` | Integer `1`. |
| `title` | Non-empty text, at most 160 characters. |
| `description` | Non-empty text, at most 1,600 characters; state the source and modeled scope. |
| `nodes` | 1–50 objects: `id`, `label` (1–100 characters), `layer` (integer 0–6). |
| `edges` | 0–200 objects: `from`, `to`, `mode`, `reason`, `evidence`. |
| `journeys` | 1–12 unique node IDs representing user-visible entrypoints. |
| `scenarios` | Optional, 0–12 objects: unique `id`, `label` (1–120 characters), `down` (1–50 unique node IDs). Omit for no presets. |
| `limitations` | 1–20 non-empty strings, at most 1,000 characters each. |

IDs start with a lowercase letter and contain only lowercase letters, digits or hyphens, at most 48 characters. Node IDs must be unique. Layers determine columns, not causal priority. Keep individual maps readable; the limits are ceilings, not targets.

## Dependencies

`from` depends on `to`. Both must exist and differ. Each pair may appear once. `mode` is `required`, `optional` or `unknown`; `reason` is 1–800 characters.

`evidence` is an array of at most 12 references. A reference has a repository-relative POSIX `path`, positive integer `line`, and optional inclusive `endLine` (defaults to `line`). Required and optional edges need at least one reference. Unknown edges may use `[]`; describe the missing evidence in their reason.

Example edge, to adapt to actual inspected code:

```json
{
  "from": "checkout",
  "to": "recommendations",
  "mode": "optional",
  "reason": "Recommendation errors become an empty list; the order still completes.",
  "evidence": [{ "path": "src/checkout.mjs", "line": 18, "endLine": 24 }]
}
```

Paths cannot contain traversal segments, `.git`, backslashes or control characters. Symlinks outside `--source` are rejected. Referenced files must be UTF-8, no larger than 2 MiB; line numbers cannot exceed 200,000. Input JSON cannot exceed 1 MiB. Missing files and out-of-range lines fail before HTML is written. The tool does not verify that cited code supports the stated claim.

## Propagation semantics

Selected failures become `offline`. For each caller → dependency edge:

| Dependency's state | Required edge | Optional edge | Unknown edge |
| --- | --- | --- | --- |
| `unaffected` | Unaffected | Unaffected | Unaffected |
| `offline` or `blocked` | Blocked | Degraded | Unknown |
| `degraded` | Degraded | Degraded | Unknown |
| `unknown` | Unknown | Unknown | Unknown |

Across multiple dependencies, the most severe result wins: offline > blocked > unknown > degraded > unaffected. Explicitly offline nodes stay offline. Cycles converge because states only increase. This conservative Boolean model does not represent partial load, traffic, quorum, call order, conditional routing, latency, retry budgets or recovery. Split conditional paths into separate scoped models rather than imply that all calls occur together.

“Unaffected” means no selected failure propagates to this node in this model. It is not evidence that the real service works.

## Artifact and source snapshot

The renderer strips unrecognized fields and generates a `snapshot` containing SHA-256 of cited files and a combined fingerprint. This is an inspection snapshot, not a signature, semantic attestation, whole-repository hash or automatic stale-source detector. Source text is not embedded: only paths, lines, reasons and hashes appear in the HTML.

The page needs no server and makes no external requests. Its GitHub links navigate only when clicked. “Export rehearsal” downloads Markdown containing the selected outages, outcomes, causal paths and limitations. “Download model” emits editable input JSON without the generated snapshot. Artifact contents can still expose architecture information; inspect before publishing.
