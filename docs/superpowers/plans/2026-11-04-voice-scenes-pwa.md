# Voice, Scenes and PWA Implementation Plan

> Execute inline using superpowers:executing-plans and test-driven-development. User delegated implementation.

**Goal:** Context-sensitive illustration, questions inside narrated chat, natural Spanish audio, installable mobile app.
**Architecture:** Extend shared contracts; independent bounded audio service and client player; native Next manifest and scoped static service worker.
**Spec:** ../specs/2026-11-04-voice-scenes-pwa-design.md

## Constraints and review focus
- Preserve saves and secrets. No model branding in game UI.
- Never regenerate images merely because a turn occurred.
- Whole narrator message including contextual question is spoken; no image descriptions.
- Repeated listen, reset races, autoplay refusal and quota errors must recover.
- Offline launch must restore saved chat, never cache API configuration or POST data.
- Mobile 320px width, short viewport and install guidance; no public deployment assumed.

## Tasks
- [x] 1. Failing tests for contextual question, image decisions, old-save migration, speech splitting/validation/cache; implement contracts and server voice.
- [x] 2. Wire scene selection, audio controls and model-label removal; browser tests including cancellation and retries.
- [x] 3. Manifest/icons/service worker/offline mobile UX; production browser tests and responsive screenshots.
- [x] 4. Review, full verification, actual Cloudflare speech and scene calls; sync changed source preserving .env.local; rebuild/restart original.
