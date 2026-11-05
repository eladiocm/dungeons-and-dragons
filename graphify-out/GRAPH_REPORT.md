# Graph Report - src  (2026-11-05)

## Corpus Check
- Corpus is ~42,728 words - fits in a single context window. You may not need a graph.

## Summary
- 470 nodes · 1615 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Módulos auxiliares
- Proveedores y archivo legado
- Catálogo y creación
- Mesa y seguimiento narrado
- Combate y efectos
- Persistencia y Master
- Rutas de sesión
- Validación y medios
- Dictado y grabación
- Aplicación y manifiesto

## God Nodes (most connected - your core abstractions)
1. `RuleError` - 92 edges
2. `executePlan()` - 38 edges
3. `getHero()` - 23 edges
4. `isHero()` - 20 edges
5. `hasCondition()` - 20 edges
6. `castSpell()` - 20 edges
7. `SessionStore` - 20 edges
8. `GameSession` - 19 edges
9. `GameError` - 18 edges
10. `GameService` - 18 edges

## Surprising Connections (you probably didn't know these)
- `text()` --calls--> `RuleError`  [EXTRACTED]
  ../src/server/master.ts → ../src/game/types.ts
- `GET()` --calls--> `publicConfig()`  [EXTRACTED]
  ../src/app/api/config/route.ts → ../src/lib/ai-provider.ts
- `POST()` --calls--> `sessionApi()`  [EXTRACTED]
  ../src/app/api/sessions/[id]/commands/route.ts → ../src/server/runtime.ts
- `GET()` --calls--> `sessionApi()`  [EXTRACTED]
  ../src/app/api/sessions/[id]/export/route.ts → ../src/server/runtime.ts
- `POST()` --calls--> `mediaApi()`  [EXTRACTED]
  ../src/app/api/sessions/[id]/image/route.ts → ../src/server/runtime.ts

## Import Cycles
- None detected.

## Communities (13 total, 4 thin omitted)

### Community 0 - "Módulos auxiliares"
Cohesion: 0.09
Nodes (61): actionDice(), activateBeacon(), applyOperation(), creative(), interact(), skillCheck(), takeLens(), validateOperation() (+53 more)

### Community 1 - "Proveedores y archivo legado"
Cohesion: 0.08
Nodes (46): dynamic, GET(), Pending, request(), useGame(), AIProvider, createProvider(), cloudflare() (+38 more)

### Community 2 - "Catálogo y creación"
Cohesion: 0.10
Nodes (52): CharacterCreator(), Choices(), CLASS_ICON, skillOptions(), spellOptions(), featureInfo(), FEATURES, IconName (+44 more)

### Community 3 - "Mesa y seguimiento narrado"
Cohesion: 0.10
Nodes (37): InstallEvent, PwaControls(), AbilityScores(), CharacterSheet(), signed(), DiceTray(), GameMenu(), Narrator (+29 more)

### Community 4 - "Combate y efectos"
Cohesion: 0.15
Nodes (48): assertActor(), condition(), damageActor(), distance(), dodging(), effectiveAc(), endConcentration(), hasCondition() (+40 more)

### Community 5 - "Persistencia y Master"
Cohesion: 0.09
Nodes (18): publicSession(), CampaignMessage, GameCommand, GameSession, Roller, GameService, hashPayload(), context() (+10 more)

### Community 6 - "Rutas de sesión"
Cohesion: 0.06
Nodes (37): dynamic, POST(), runtime, dynamic, GET(), runtime, maxDuration, POST() (+29 more)

### Community 7 - "Validación y medios"
Cohesion: 0.17
Nodes (27): choice(), flag(), keys(), number(), object(), operations(), point(), spellOptions() (+19 more)

### Community 8 - "Dictado y grabación"
Cohesion: 0.15
Nodes (10): SpeechWindow, useDictation(), DictationController, DictationPhase, DictationPlatform, DictationState, RecognitionLike, RecorderLike (+2 more)

## Knowledge Gaps
- **53 isolated node(s):** `dynamic`, `runtime`, `dynamic`, `runtime`, `dynamic` (+48 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 80 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gameService()` connect `Rutas de sesión` to `Proveedores y archivo legado`, `Persistencia y Master`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `executePlan()` connect `Módulos auxiliares` to `Combate y efectos`, `Validación y medios`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `dynamic`, `runtime`, `dynamic` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Módulos auxiliares` be split into smaller, more focused modules?**
  _Cohesion score 0.09218612818261633 - nodes in this community are weakly interconnected._
- **Should `Proveedores y archivo legado` be split into smaller, more focused modules?**
  _Cohesion score 0.07936507936507936 - nodes in this community are weakly interconnected._
- **Should `Catálogo y creación` be split into smaller, more focused modules?**
  _Cohesion score 0.09860859044162129 - nodes in this community are weakly interconnected._
- **Should `Mesa y seguimiento narrado` be split into smaller, more focused modules?**
  _Cohesion score 0.09713487071977638 - nodes in this community are weakly interconnected._
## Alcance e integridad

Extracción estructural del código en src. Excluye SVG, documentos semánticos, dependencias, claves, sesiones y medios. Hay referencias no resueltas y relaciones combinadas por el extractor: consultar GRAPH_HEALTH.md. Es una ayuda de navegación, no una verificación de corrección de la aplicación.
