# Security and data boundaries

Faultline's renderer reads the model and explicitly cited local UTF-8 files. It checks model size, types, graph references, path containment including symlinks, file size and line ranges. It never runs source repositories, fetches model-provided URLs, connects to services or injects live faults. Existing output files are preserved.

Model text is embedded as escaped JSON and displayed through DOM text nodes. Source contents are hashed, not embedded. The resulting HTML still includes component names, explanations and relative source paths; treat internal maps as internal information.

These checks do not verify source interpretation, establish live system behavior, provide a signed attestation or protect against a concurrently malicious local process swapping files. Review both code and model before using the artifact for decisions. Exported rehearsal notes should be reviewed before publishing.

For a vulnerability, use GitHub's private vulnerability reporting when enabled on this repository. Otherwise open an issue with the affected version and a high-level description, without sensitive data or an exploit payload, so a private reporting route can be arranged.
