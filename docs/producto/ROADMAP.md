# Roadmap por fases — Overrun

Plan de fases (**MVP → v1 → v2 → v3**) con lo que se aborda en cada una, los requerimientos
(`REQ-NNN`) incluidos y las dudas (`P-NNN`) que hay que cerrar. Requerimientos en
[`REQUERIMIENTOS.md`](REQUERIMIENTOS.md); decisiones y dudas en
[`../decisiones/POR-ACLARAR.md`](../decisiones/POR-ACLARAR.md).

Roadmap base: **v1** navegador + observabilidad · **v2** pentesting · **v3** IA + MCP (D-011).

---

## FASE MVP — vertical slice (prueba de tesis)

**Objetivo:** demostrar que un navegador Electron carga una página **a tamaño completo** con un
**overlay flotante colapsable** alimentado por **CDP** que muestra **Network** en vivo, **sin tocar
el viewport**.

**REQ:** 001, 002, 010, 011, 012, 014, 020, 060–063, 065, 066, 070.

**Detalles a abordar:**
- Shell Electron: ventana con dos `WebContentsView` apiladas (`pageView` + `overlayView`), z-order,
  bounds (overlay anclado a esquina).
- Chrome mínimo: barra de direcciones, atrás/adelante/recargar, una pestaña.
- Adjuntar **CDP** a `pageView` (`webContents.debugger`, protocolo `1.3`).
- **Capa `Overrun Events`** (REQ-066): normalizar `Network.*` a eventos tipados por dominio. Nace
  acá aunque solo haya un dominio — es el cimiento del resto.
- Puente **IPC** main → `overlayView`.
- UI del overlay: panel **Network** con el desglose de REQ-020 (lista, timing/waterfall,
  throughput); colapsable a pill.
- Validar **REQ-014**: el overlay es vista separada, no vive en el DOM de la página; comprobar que
  `innerWidth/visualViewport/matchMedia/resize` de la página no cambian al abrir/cerrar.
- Instrumentación fuera del proceso de la página (REQ-063, efecto observador).
- Build **Windows + Linux** (AppImage), sin firma.

**Dudas a cerrar antes/durante:** ninguna pendiente — cerradas.
- ✅ **D-015** — primer panel = **Network**.
- ✅ **D-016** — stack UI = **React + TS + uPlot/Canvas** (tablas virtualizadas con TanStack Virtual).

**Hecho cuando:** navegás a un sitio real, ves sus requests en vivo en el overlay, y
colapsás/expandís sin que la página se redimensione. ✅ **Implementado** — panel Network con
tabla virtualizada + detalle (headers, payload, response, timing waterfall), throughput en Canvas,
overlay arrastrable/colapsable, resolución en la barra, menú nativo removido, fuentes de marca
empaquetadas. Código en `src/`.

---

## FASE v1 — primer release (navegador usable + observabilidad completa + marca)

**Objetivo:** producto usable a diario: los cinco paneles, viewports, branding propio y
distribución en Windows + Linux.

**REQ:** 003, 013, 021, 022, 023, 024, 050–053, 064, 071, 073, 080.

**Detalles a abordar:**
- **Paneles restantes**, cada uno sobre `Overrun Events`:
  - Consola (REQ-021) — logs/warn/error/excepciones.
  - Memoria (REQ-022) — heap JS, contadores DOM, crecimiento.
  - CPU/Rendimiento (REQ-023) — señales atribuibles a la página (JS, long tasks, render/frame,
    carga); CPU% de proceso opcional y etiquetado aparte.
  - Storage (REQ-024) — cookies, local/session, IndexedDB, cache.
- **Viewports/dispositivos** (REQ-003) vía CDP `Emulation`.
- Overlay: **click-through** opcional (REQ-013), pestañas de paneles completas; multi-pestaña del
  navegador.
- **Branding** (REQ-050–053): nombre definitivo, icono, chrome frameless pulido, instalador,
  panel "About", User-Agent, opción de navegador default.
- **Optimización nivel 1** (REQ-064): switches (`--disable-features`), procesos acotados, overlay
  lazy, trim de packaging.
- **Persistencia** (REQ-080): definir si se guardan sesiones de métricas / historial o todo en
  memoria.
- **Distribución** (REQ-073): dominio, canal de descarga, naming del instalador.

**Dudas a cerrar:** todas cerradas.
- ✅ **D-017** click-through (toggle manual) · **D-018** persistencia (memoria + export HAR/JSON) ·
  **D-019** User-Agent (`Chrome` + `Overrun/x.y`) · **D-020** navegador default (opcional, off) ·
  **D-022** distribución (GitHub Releases).
- **P-012** (nombre público) queda como gate solo para distribución pública; el codename interno
  `Overrun` no bloquea nada (D-023).

**Hecho cuando:** un dev lo usa como navegador diario con los 5 paneles, viewports y marca propia,
instalable en Windows + Linux.

---

## FASE v2 — seguridad / pentesting

**Objetivo:** interceptación y análisis de seguridad web. Dominio **Security** sobre el mismo bus
`Overrun Events`.

**REQ:** 040, 041, 042.

**Detalles a abordar:**
- **Interceptar/modificar requests** (REQ-040) vía CDP `Fetch`: pausar, reescribir, bloquear —
  base de un mini-Burp.
- Dominio **Security** en `Overrun Events` (entra sin rediseño, REQ-066).
- Evaluar **proxy tipo mitmproxy** (REQ-041) para tráfico **no-CDP**.
- **Superficie de ataque mínima** (REQ-042): evaluar salto a **CEF/fork** con build recortado del
  motor + sin telemetría. La capa CDP desacoplada (REQ-062) permite reusar la lógica si se migra la
  base.

**Alcance (D-021):** arranca con CDP `Fetch` (mini-Burp). El proxy no-CDP (mitmproxy) y el posible
salto de base se **evalúan según necesidad**, no de entrada.

**Hecho cuando:** interceptás y modificás el tráfico de una app y el panel Security muestra
hallazgos.

---

## FASE v3 — IA + MCP

**Objetivo:** integración con asistentes IA y observabilidad de IA.

**REQ:** 030, 031, 090.

**Detalles a abordar:**
- **Panel de tokens de IA** (REQ-030): interceptar hosts LLM (`Fetch`/`Network`), parsear `usage`
  por proveedor (Anthropic, OpenAI, …).
- **Servidor MCP** (REQ-090): expone `Overrun Events` + control del navegador (navegar, click,
  screenshot) vía MCP, para que Claude et al. manejen/lean Overrun. **Reusa el bus** (REQ-066), no
  reimplementa. Independiente de los paneles de IA → **puede adelantarse** si conviene (D-012).
- Otras funcionalidades de IA (REQ-031, a definir).

**Dudas a cerrar:**
- Proveedores de tokens en v1 del panel; forma de parsear `usage` por proveedor.
- ¿Se adelanta el MCP antes de v3?

**Hecho cuando:** Claude maneja y lee Overrun vía MCP; el panel de tokens muestra consumo real.

---

## Estado de dudas

Fase 0 cerrada — todas las dudas técnicas resueltas (D-015 a D-023). Único gate abierto:

| Duda | Fase | Notas |
|---|---|---|
| P-012 nombre público | (público) | diferido (D-023); rename antes de release público, no bloquea v1 interno |
