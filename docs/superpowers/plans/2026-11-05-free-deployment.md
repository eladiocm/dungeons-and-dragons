# Free Demo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Desplegar la demo en Vercel Hobby con Supabase Free y Cloudflare AI, sin perder autoridad/idempotencia.
**Architecture:** Repositorio async intercambiable SQLite/Supabase; Postgres privado y RPC solo backend con credencial separada; Next mantiene motor y API. CAS transaccional protege persistencia.
**Tech Stack:** Next16/React19/TS7/Node24/Postgres17, fetch nativo; sin dependencia nueva.
**Spec:** docs/superpowers/specs/2026-11-05-free-deployment.md

## Global Constraints
Solo servicios gratuitos; trabajo develop; secretos fuera de Git/bundle/SW; no datos privados en logs; SQLite local y copias intactos; no multijugador/mundoabierto en esta etapa. Autorización de plataforma/migración/integración/publicación ya recibida.

## Review Focus
1. Replay y dos instancias concurrentes: solo un resultado confirmado; CAS409 sin duplicar daño/dados.
2. Clave pública/otro propietario: no acceder a secretos ni mutar partidas.
3. Cold start y medios: clave estable, persistencia remota, sin .data temporal ni llamadas de IA repetidas por reintentos.
4. Narración simultánea con acción/pending: no sobrescribe mecánica ni resucita prosa vieja.
5. Cuotas y fallos/red: límite compartido, error explícito, caché acotada, borrador/guardado preservados.

### Task 1: Contrato async y servicio/API
Files: src/server/session-repository.ts, game-service.ts, session-api.ts, media-api.ts; tests/async-sessions.test.ts y pruebas existentes.
Interfaces: SessionRepository métodos MaybePromise, GameService métodos async; mantener SessionStore sync local.
- [x] RED HTTP create/list/get/command/export/import sobre repositorio async con propiedad privada y replay.
- [x] Implementar contrato/await; adaptar pruebas al contrato async, sin cambiar reglas.
- [x] Unitarias/tipos/lint verdes y commit.

### Task 2: Supabase transaccional
Files: supabase/migrations/20261105_game_backend.sql, src/server/supabase-store.ts, tests/integration/supabase.test.ts.
Interfaces: RPC dnd_backend(secret,op,args), SupabaseStore implementa SessionRepository; errores404/409/413/429 mapeados sin filtrar detallesSQL.
- [x] RED adapter ausente y pruebas reales sin esquema; crear pruebas ownership/replay/concurrentCAS/claims/pendingamend/cache/cuota.
- [x] Implementar SQL privado/RLS/grants/credencial hash y cliente fetch con timeout, CAS/JSONvalidado.
- [x] Aplicar migración solo al proyecto nuevo djfonndfgosmbjzarfwu; configurar credencial fuera del SQL versionado, verificar anon/otro propietario y advisors.
- [x] Pruebas reales verdes, commit.

### Task 3: Runtime y cuotas
Files: runtime.ts, runtime-config.ts, .env.example, media-api.ts si necesario, vercel.json, pruebas cloud.
Interfaces: backend cloud explícito, clave copias SAVE_KEY_BASE64, URL/clave publicable/credencialRPC, presupuesto global de proveedores.
- [x] RED cloud sin configuración completa falla sin tocar disco; cuota remota limita llamadas y caché no gasta.
- [x] Elegir backend por GAME_STORE; SQLite solo local; límite compartido antes de cada inferencia. No imprimir secretos.
- [x] Tipos/lint/unit/build y27E2E verdes; commit.

### Task 4: Publicar y comprobar
Files: docs/mvp/* README AGENTS; configuración Vercel y secretos remotos.
- [x] Crear proyecto Vercel de la cuenta Hobby, enlazar repositorio, región cercana DB; secretos solo production, origen HTTPS exacto.
- [x] Revisar diff/secretos, integrar/push main, crear deployment production del SHA verificado.
- [x] Esperar build, comprobar HTTPS/API/ownership/persistencia/creación/acciones/narración/PWA sobre URL real con cuota mínima.
- [x] Revisión final fresca según executing-plans, corregir hallazgos importantes con regresión; documentación/memoria/URL real. No declarar hardware móvil probado.
