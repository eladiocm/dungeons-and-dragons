# Graph Report - dungeons-and-dragons  (2026-11-06)

## Corpus Check
- 131 files · ~85,764 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 841 nodes · 2315 edges · 43 communities (32 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `42c8285c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- session-actions.ts
- GameSession
- game-contract.ts
- use-campaign.ts
- engine.ts
- session-api.ts
- sessionApi
- character.ts
- voice-pwa.spec.ts
- package.json
- use-dictation.ts
- biome.json
- compilerOptions
- MVP de aventura de rol — propuesta para revisión
- Instrucciones de desarrollo para agentes
- Mapa de archivos
- mvp/README.md
- Investigación y alcance de reglas
- Calabozos y Dragones — La última luz de Valdumbría
- Review Focus
- vercel.json
- Arquitectura del MVP
- Despliegue y uso en móvil
- Estado del MVP 0.4.1
- Free AI Implementation Plan
- Aventura con IA gratuita
- Voice, Scenes and PWA Implementation Plan
- fixture-ai.mjs
- 2026-11-04-voice-scenes-pwa-design.md
- specs/2026-11-05-free-deployment.md
- postcss.config.mjs
- game-service.ts
- RuleError
- runtime.ts
- sessions.test.ts
- SessionStore
- DISENO.md
- 2026-11-06-chat-clarifications.md
- 2026-11-06-free-ai-routing.md

## God Nodes (most connected - your core abstractions)
1. `RuleError` - 101 edges
2. `executePlan()` - 38 edges
3. `GameSession` - 33 edges
4. `createCharacter()` - 29 edges
5. `suggestCharacter()` - 25 edges
6. `getHero()` - 23 edges
7. `GameService` - 23 edges
8. `SupabaseStore` - 23 edges
9. `SessionStore` - 22 edges
10. `castSpell()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Task 4: Aventura y transiciones de sesión` --references--> `publicSession()`  [INFERRED]
  docs/superpowers/plans/2026-11-05-srd-mvp.md → src/game/engine.ts
- `Task 5: Persistencia, sesión privada y HTTP` --references--> `SessionRepository`  [INFERRED]
  docs/superpowers/plans/2026-11-05-srd-mvp.md → src/server/session-repository.ts
- `Task 7: Creación y mesa adaptable` --references--> `PublicSession`  [INFERRED]
  docs/superpowers/plans/2026-11-05-srd-mvp.md → src/game/session-types.ts
- `Task 1: Catálogo y creación verificable` --references--> `GameSession`  [INFERRED]
  docs/superpowers/plans/2026-11-05-srd-mvp.md → src/game/session-types.ts
- `Task 2: Dados, pruebas, daño, muerte y descansos` --references--> `CharacterState`  [INFERRED]
  docs/superpowers/plans/2026-11-05-srd-mvp.md → src/game/types.ts

## Import Cycles
- None detected.

## Communities (43 total, 11 thin omitted)

### Community 0 - "session-actions.ts"
Cohesion: 0.10
Nodes (82): Task 2: Dados, pruebas, daño, muerte y descansos, actionDice(), activateBeacon(), applyOperation(), creative(), interact(), skillCheck(), takeLens() (+74 more)

### Community 1 - "GameSession"
Cohesion: 0.14
Nodes (7): GameSession, MaybePromise, SessionSummary, StoredResult, Config, SupabaseStore, repo()

### Community 2 - "game-contract.ts"
Cohesion: 0.07
Nodes (53): CORE, dynamic, GET(), Pending, request(), useGame(), AIProvider, createProvider() (+45 more)

### Community 3 - "use-campaign.ts"
Cohesion: 0.10
Nodes (38): react, InstallEvent, PwaControls(), DiceTray(), GameMenu(), Narrator, GameTable(), Icon() (+30 more)

### Community 4 - "engine.ts"
Cohesion: 0.07
Nodes (48): ADVENTURE, adventureNpcs(), initialWorld(), npc(), object(), OPENING, SCENES, scores (+40 more)

### Community 5 - "session-api.ts"
Cohesion: 0.21
Nodes (15): createMediaApi(), fields(), apiFailure(), apiResponse(), commandBody(), exact(), id(), jsonBody() (+7 more)

### Community 6 - "sessionApi"
Cohesion: 0.09
Nodes (23): dynamic, POST(), runtime, dynamic, GET(), runtime, maxDuration, POST() (+15 more)

### Community 7 - "character.ts"
Cohesion: 0.11
Nodes (49): Task 1: Catálogo y creación verificable, CharacterCreator(), Choices(), CLASS_ICON, skillOptions(), spellOptions(), AbilityScores(), CharacterSheet() (+41 more)

### Community 8 - "voice-pwa.spec.ts"
Cohesion: 0.06
Nodes (20): Ajuste posterior — navegación del creador, Ejecución del MVP, Matriz mínima, Migración cloud 0.4.1, Plan de aceptación y evidencia, Principios, Pruebas reales y límites, Puerta de integración (+12 more)

### Community 9 - "package.json"
Cohesion: 0.04
Nodes (41): nextConfig, dependencies, next, react, react-dom, devDependencies, @biomejs/biome, @playwright/test (+33 more)

### Community 10 - "use-dictation.ts"
Cohesion: 0.12
Nodes (10): SpeechWindow, useDictation(), DictationController, DictationPhase, DictationPlatform, DictationState, RecognitionLike, RecorderLike (+2 more)

### Community 11 - "biome.json"
Cohesion: 0.08
Nodes (25): source, assist, actions, css, parser, files, ignoreUnknown, formatter (+17 more)

### Community 12 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 13 - "MVP de aventura de rol — propuesta para revisión"
Cohesion: 0.12
Nodes (16): Acuerdos del usuario, Aventura propuesta: La última luz de Valdumbría, Catálogo inicial propuesto por el implementador, Decisiones propuestas y aprobadas por el usuario, Dictado de acciones, Diseño de la mesa, Enfoque propuesto, Etapas y condiciones de salida (+8 more)

### Community 14 - "Instrucciones de desarrollo para agentes"
Cohesion: 0.22
Nodes (9): Acuerdos, Arquitectura e invariantes, Contexto y estado real, Documentación y memoria, Guardado cloud y publicación, Instrucciones de desarrollo para agentes, Pruebas y evidencia, Seguridad del trabajo (+1 more)

### Community 15 - "Mapa de archivos"
Cohesion: 0.15
Nodes (12): Global Constraints, Mapa de archivos, Review Focus, Revisión del plan, SRD solo MVP Implementation Plan, Task 3: Armas, rasgos y magia del catálogo, Task 4: Aventura y transiciones de sesión, Task 5: Persistencia, sesión privada y HTTP (+4 more)

### Community 16 - "mvp/README.md"
Cohesion: 0.24
Nodes (4): Guía para agentes, This is NOT the Next.js you know, Manifiesto de contenido, Documentación del MVP

### Community 17 - "Investigación y alcance de reglas"
Cohesion: 0.20
Nodes (10): Adaptaciones originales del módulo implementadas, Atribución, Catálogo de magia propuesto, Clases iniciales, Combate, supervivencia y recursos, Creación, Investigación y alcance de reglas, Orígenes (+2 more)

### Community 18 - "Calabozos y Dragones — La última luz de Valdumbría"
Cohesion: 0.22
Nodes (9): Atribución, Calabozos y Dragones — La última luz de Valdumbría, Cómo jugar, Desarrollo, pruebas y arquitectura, Despliegue gratuito 0.4.1, Ejecutar en Windows, Guardados y copias privadas, IA gratuita y voz (+1 more)

### Community 19 - "Review Focus"
Cohesion: 0.25
Nodes (7): Free Demo Deployment Implementation Plan, Global Constraints, Review Focus, Task 1: Contrato async y servicio/API, Task 2: Supabase transaccional, Task 3: Runtime y cuotas, Task 4: Publicar y comprobar

### Community 20 - "vercel.json"
Cohesion: 0.25
Nodes (7): develop, functions, src/app/api/**/*.ts, git, deploymentEnabled, regions, maxDuration

### Community 21 - "Arquitectura del MVP"
Cohesion: 0.29
Nodes (7): Adaptación cloud 0.4.1, Arquitectura del MVP, Dominio y flujo, Fronteras, Master y medios, Persistencia, PWA y evolución

### Community 22 - "Despliegue y uso en móvil"
Cohesion: 0.25
Nodes (8): Copias y recuperación, Despliegue y uso en móvil, Elección de alojamiento — revisión del 5 de noviembre de 2026, Implementación aprobada y preparada — 6 de noviembre de 2026, Publicación posterior, Publicado y verificado, Requisitos del alojamiento, Restricción vigente: solo servicios gratuitos

### Community 23 - "Estado del MVP 0.4.1"
Cohesion: 0.33
Nodes (6): Estado del MVP 0.4.1, Implementado, Limitaciones y pendientes explícitos, Próximas etapas, Release cloud, Verificación

### Community 24 - "Free AI Implementation Plan"
Cohesion: 0.40
Nodes (4): Free AI Implementation Plan, Global Constraints, Review Focus, Tasks

### Community 25 - "Aventura con IA gratuita"
Cohesion: 0.40
Nodes (4): Aventura con IA gratuita, Comportamiento y límites, Enfoques considerados, Mantenimiento y pruebas

### Community 26 - "Voice, Scenes and PWA Implementation Plan"
Cohesion: 0.50
Nodes (3): Constraints and review focus, Tasks, Voice, Scenes and PWA Implementation Plan

### Community 35 - "game-service.ts"
Cohesion: 0.16
Nodes (8): publicSession(), GameCommand, GameService, hashPayload(), createMaster(), Master, SessionRepository, setup()

### Community 36 - "RuleError"
Cohesion: 0.25
Nodes (17): choice(), flag(), keys(), number(), object(), operations(), point(), spellOptions() (+9 more)

### Community 37 - "runtime.ts"
Cohesion: 0.17
Nodes (14): maxDuration, POST(), runtime, maxDuration, POST(), runtime, maxDuration, POST() (+6 more)

### Community 38 - "sessions.test.ts"
Cohesion: 0.19
Nodes (4): AAD, SealedSave, createSessionApi(), file

### Community 39 - "SessionStore"
Cohesion: 0.21
Nodes (3): decode(), encode(), SessionStore

## Knowledge Gaps
- **223 isolated node(s):** `$schema`, `enabled`, `ignoreUnknown`, `enabled`, `indentStyle` (+218 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 297 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gameService()` connect `runtime.ts` to `GameSession`, `game-contract.ts`, `game-service.ts`, `engine.ts`, `SessionStore`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `GameService` connect `game-service.ts` to `session-actions.ts`, `RuleError`, `runtime.ts`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `transition()` connect `engine.ts` to `session-actions.ts`, `RuleError`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `$schema`, `enabled`, `ignoreUnknown` to the rest of the system?**
  _223 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `session-actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09630459126539753 - nodes in this community are weakly interconnected._
- **Should `GameSession` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Should `game-contract.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06771929824561404 - nodes in this community are weakly interconnected._