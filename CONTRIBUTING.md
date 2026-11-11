# Contributing

Faultline is a focused Agent Skill and an offline renderer. Start with a reproducible problem or a small source-backed example. Larger features benefit from an issue describing the user need before implementation.

Use Node.js 22+. There are no package dependencies:

```bash
npm test
npm run check:demo
```

For a model change, check references against the actual source. Explain required versus optional behavior; leave missing adapter or provider behavior unknown. Example maps must use public, suitably licensed or original fixtures and identify their scope. Do not upload internal architecture or credentials.

For a logic change, add a focused behavior test. For viewer changes, open a newly generated HTML file and check a required, optional and unknown scenario where present, combined failures, Restore all, keyboard operation and a narrow screen. Check that text-shaped HTML renders as text and the page works offline. Source templates live in `assets/`; `docs/index.html` is generated from `examples/checkout.model.json`.

To update the bundled demo, render to a new temporary filename, inspect it, then replace `docs/index.html` with that reviewed generated output. Update `docs/preview.png` with a real browser screenshot if the visible behavior changes. Do not edit the generated HTML as the source of a fix.

Keep contributions small. Runtime dependencies, agent-specific integrations, automatic scanners and live failure injection are outside the current product scope. A clear failing example is often the most useful contribution.
