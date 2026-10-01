# Contributing

Thank you for considering a contribution to MyHealthData. This project handles sensitive personal health information, so contributions should be careful, reviewable, and aligned with the local-first privacy model.

## Project Assumptions

- The app is built with React, TypeScript, and Vite.
- Browser-local IndexedDB is the v0.1 storage layer.
- The interactive body model is expected to use Three.js / React Three Fiber.
- v0.1 should not require a backend, account system, analytics service, or remote database.

## Local Setup

Install dependencies:

```sh
npm install
```

Start the dev server:

```sh
npm run dev
```

The development server is intentionally fixed to `http://127.0.0.1:5173`.
If that port is already occupied, Vite exits instead of silently moving the
app to another port and leaving an old browser tab pointing at a blank page.
The production preview uses `http://127.0.0.1:4173`.

Run quality checks before opening a pull request:

```sh
npm run verify
npm audit --omit=dev --audit-level=high
```

`npm run verify` is the canonical local gate. It runs the TypeScript
typecheck, the Web test suite, the Hub and MCP tests, and the production
build in the same order used by CI.

Preview the production build:

```sh
npm run preview
```

## Docker-Based Local Development

A Dockerfile is not required for v0.1. Contributors who prefer an isolated environment can use the official Node image:

```sh
docker run --rm -it \
  -v "$PWD":/app \
  -w /app \
  -p 5173:5173 \
  node:22-bookworm \
  bash -lc "npm install && npm run dev -- --host 0.0.0.0"
```

For a build check:

```sh
docker run --rm -it \
  -v "$PWD":/app \
  -w /app \
  node:22-bookworm \
  bash -lc "npm install && npm run build"
```

## Contribution Workflow

1. Open or find an issue that describes the problem.
2. Keep changes focused and explain the user impact.
3. Include tests or verification notes appropriate to the change.
4. Run `npm run verify` and the production-dependency audit.
5. Update documentation when behavior, privacy boundaries, data formats, or setup steps change.

## Privacy Review Checklist

Before submitting a change, ask:

- Does this send any health data, metadata, event data, or identifiers over the network?
- Does this introduce a dependency that collects telemetry by default?
- Does this store more personal data than the feature needs?
- Does this make export, deletion, or recovery harder?
- Does this change the trust boundary from local browser storage?
- Does this need user consent, documentation, or a new setting?

If the answer to any question is yes, document the tradeoff clearly in the pull request.

## Medical Safety Guidelines

MyHealthData must not diagnose, prescribe, triage, or recommend treatment. Avoid language that implies clinical certainty. Features may help users organize observations, prepare questions, or export information, but they must not replace qualified medical advice.

Do not add:

- Medication change recommendations.
- Emergency decision trees.
- Diagnostic scoring that presents a likely condition.
- Claims that the app can detect, treat, prevent, or cure disease.

## Accessibility Expectations

Core workflows should support:

- Keyboard navigation.
- Visible focus states.
- Labels for form controls.
- Screen reader-friendly names and validation messages.
- Sufficient color contrast.
- Reduced-motion preferences where animation is used.
- Non-3D alternatives for body-region selection.

## Documentation Guidelines

Documentation should be direct, specific, and honest about project limits. Do not overstate security guarantees for browser local storage. Do not imply that local storage is encrypted unless that has been implemented and reviewed.

When adding user-facing documentation, include:

- Where data is stored.
- How data can be exported.
- How data can be deleted.
- What the feature does not do medically.

## Dependency Guidelines

Dependencies should be added conservatively. Prefer libraries that are actively maintained, typed, compatible with Vite, and usable without hosted services. Dependencies that process health data, add telemetry, or make network requests need explicit review.

## Community Standards

Be respectful and practical in issues, reviews, and discussions. Health software can involve personal, stressful, or high-stakes context; assume contributors and users deserve clear explanations and careful handling of sensitive details.

## Medical Disclaimer

MyHealthData is for personal organization only. It is not a medical device, diagnostic system, electronic health record, or substitute for professional medical advice. Do not use it for emergencies or urgent medical decisions. Consult qualified health professionals for diagnosis, treatment, medication decisions, and interpretation of clinical results.
