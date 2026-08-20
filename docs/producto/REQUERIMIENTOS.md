# Requerimientos — Overrun

Requisitos formales (`REQ-NNN`) derivados de las decisiones tomadas. Cada uno enlaza a su decisión
(`D-NNN`) o duda abierta (`P-NNN`) en [`../decisiones/POR-ACLARAR.md`](../decisiones/POR-ACLARAR.md).

**Prioridad:** `MVP` (vertical slice inicial) · `v1` (primer release: navegador + observabilidad) ·
`v2` (pentesting / seguridad) · `v3` (IA + servidor MCP). Ver roadmap en
[`D-011`](../decisiones/POR-ACLARAR.md).
**Estado:** `Definido` · `Pendiente` (falta cerrar una duda).

---

## Navegación (base browser)

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-001 | Navegar la web como navegador Chromium: barra de direcciones, pestañas, atrás/adelante/recargar | MVP | Definido | D-001 |
| REQ-002 | La página se renderiza **a tamaño completo**; ninguna herramienta reduce el viewport | MVP | Definido | D-003 |
| REQ-003 | Selector de viewport / resolución (modos de dispositivo vía CDP `Emulation`) | v1 | Definido | — |

## Overlay de observabilidad

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-010 | Panel de herramientas como **overlay flotante** anclado a esquina, por encima de la página | MVP | Definido | D-003 |
| REQ-011 | Overlay **colapsable** a pill/burbuja; expandir/colapsar sin redimensionar la página | MVP | Definido | D-003 |
| REQ-012 | El overlay y la instrumentación operan **fuera del DOM y del contexto JavaScript** de la página, **minimizando** cualquier impacto o modificación observable sobre la app inspeccionada | MVP | Definido | D-002 |
| REQ-013 | Overlay con **click-through** por toggle manual (default: captura) | v1 | Definido | D-017 |
| REQ-014 | El overlay **no forma parte del viewport** de la página: no altera las dimensiones que la página reporta (`innerWidth/Height`, `visualViewport`, `matchMedia`/media queries, `ResizeObserver`, eventos `resize`) | MVP | Definido | D-003 |

## Paneles de métricas

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-020 | **Network** — lista de requests con desglose completo (ver [desglose](#req-020--network-desglose)) | MVP | Definido | P-002 |
| REQ-021 | **Consola** — logs, warnings, errores, excepciones no capturadas | v1 | Definido | D-002 |
| REQ-022 | **Memoria** — heap JS, contadores de DOM, detección de crecimiento | v1 | Definido | D-002 |
| REQ-023 | **CPU / Rendimiento** — señales distintas y bien delimitadas (ver [desglose](#req-023--cpu--rendimiento-desglose)) | v1 | Definido | D-002 |
| REQ-024 | **Storage** — cookies, localStorage, sessionStorage, IndexedDB, cache | v1 | Definido | D-002 |

### REQ-020 · Network — desglose

Lista de requests, cada uno con:

```
Network
├── Method            (GET/POST/…)
├── URL
├── Status            (código + texto)
├── Type              (xhr, fetch, document, script, img, ws, …)
├── Size              (transferido + descomprimido)
├── Duration          (total)
├── Timing            (DNS, connect, TLS, TTFB, download — waterfall)
├── Headers           (request + response)
├── Request payload   (body enviado)
├── Response          (body recibido / preview)
├── Initiator         (qué originó el request: script/línea, redirect, parser)
└── Connection        (id de conexión, reuso, protocolo h1/h2/h3)
```

Fuente: dominio CDP `Network`. Es la feature que más rápido demuestra el valor de Overrun → panel del MVP (P-002).

### REQ-023 · CPU / Rendimiento — desglose

"Uso de CPU" no es una sola cosa. Overrun distingue señales **no equivalentes**:

| Señal | Qué mide | Atribuible a la página | Fuente |
|---|---|---|---|
| **Tiempo de JS** | ejecución de JS en el renderer de la página | sí | CDP `Profiler` / `Performance` |
| **Long tasks** | tareas > 50 ms bloqueando el hilo principal | sí | `Performance` / PerformanceObserver |
| **Render / frame time** | tiempo de layout/paint/composite, frames caídos, FPS | sí | `Tracing` / `Performance` |
| **Métricas de carga** | DCL, LCP, TTFB, etc. | sí | `Performance` |
| **CPU% de proceso** (opcional) | CPU del proceso renderer / browser / helpers a nivel SO | **no directamente** — es del proceso, no de la página | métricas de proceso del SO |

**v1 apunta a las señales atribuibles a la página** (JS, long tasks, render/frame, carga). El
CPU% de proceso a nivel SO es una señal aparte, opcional, y se etiqueta como tal para no confundir
"CPU de la página" con "CPU del proceso".

## Seguridad / pentesting (v2)

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-040 | Interceptar / modificar requests vía CDP `Fetch` (mini-Burp) — punto de arranque de v2 | v2 | Definido | D-021 · V-010 |
| REQ-041 | Proxy tipo mitmproxy para tráfico **no-CDP** — a evaluar según necesidad | v2 | A evaluar | D-021 · V-011 |
| REQ-042 | Superficie de ataque mínima: build recortado del motor | v2 | Definido | D-007 · V-012 |

## IA + MCP (v3)

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-030 | Panel de **tokens de IA** — interceptar hosts LLM, parsear `usage` | v3 | Definido | D-006 · V-001 |
| REQ-031 | Otras funcionalidades de IA | v3 | Definido | D-006 · V-002 |
| REQ-090 | **Servidor MCP**: expone control del navegador + datos de observabilidad (reusa la capa CDP) para usar Overrun con asistentes IA (ej. Claude) | v3 | Definido | D-012 · V-020 |

## Branding

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-050 | App **brandeada**: nombre, ejecutable, icono, chrome frameless propio, instalador | v1 | Definido | D-008 |
| REQ-051 | Identidad visual Overrun (tokens, tipografía, logo) aplicada consistente | v1 | Definido | D-009 |
| REQ-052 | Navegador default del SO (opcional, **off por defecto**) + protocolo `overrun://` | v1 | Definido | D-020 |
| REQ-053 | User-Agent: UA de Chrome intacto (compat) + token `Overrun/x.y` | v1 | Definido | D-019 |

## Arquitectura (no-funcionales)

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-060 | Base **Electron + WebContentsView** (2 vistas apiladas: página + overlay) | MVP | Definido | D-001 |
| REQ-061 | Shell en **TypeScript**; hot paths en **Rust (`napi-rs`)** cuando el profiling lo justifique | MVP | Definido | D-004 · D-005 |
| REQ-062 | Capa **CDP desacoplada** de la base (reutilizable si se migra a CEF/fork) | MVP | Definido | D-002 |
| REQ-063 | **Efecto observador:** instrumentación fuera del proceso de la página | MVP | Definido | D-001 |
| REQ-064 | Optimización nivel 1: switches (`--disable-features`), procesos acotados, overlay lazy, trim de packaging | v1 | Definido | D-007 |
| REQ-065 | Código OS-específico aislado tras una **capa fina** (portabilidad) | MVP | Definido | D-010 |
| REQ-066 | **Modelo de datos de observabilidad:** capa de normalización (`Overrun Events`) entre CDP y los consumidores; un único stream de eventos tipados por dominio que alimenta **la UI y el servidor MCP** (ver [modelo](#req-066--modelo-de-datos-de-observabilidad)) | MVP | Definido | D-013 |

## Plataformas y distribución

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-070 | MVP en **Windows + Linux**, sin firma de código. macOS diferido | MVP | Definido | D-010 |
| REQ-071 | Empaquetado: Linux **AppImage**; Windows instalador NSIS/`.exe` (unsigned, SmartScreen saltable) | v1 | Definido | D-010 |
| REQ-072 | Firma futura: Azure Trusted Signing (Win) · Apple notarize (mac) | Futuro | Definido | D-010 |
| REQ-073 | Distribución vía **GitHub Releases** (AppImage + instalador/exe) | v1 | Definido | D-022 |

## Persistencia

| REQ | Requisito | Prioridad | Estado | Ref |
|---|---|---|---|---|
| REQ-080 | Métricas **en memoria** + export manual de sesión (Network → HAR, resto → JSON) | v1 | Definido | D-018 |

### REQ-066 · Modelo de datos de observabilidad

No conectar CDP directo a cada panel. Entre el protocolo y los consumidores va una capa de
**normalización** que convierte eventos crudos de CDP en un stream de **eventos tipados por
dominio** (`Overrun Events`) — timestamped, con esquema estable, fuente única de verdad.

```
                              ┌── Network
                              ├── Console
CDP ──→ Overrun Events ──────┼── Memory
        (normalización,      ├── Performance
         eventos tipados)    ├── Storage
                              └── Security   (v2)
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                    UI (overlay)        Servidor MCP (v3)
```

Por qué importa:

- **Desacopla** la UI del formato crudo de CDP (REQ-062): si cambia CDP, cambia solo la capa de
  normalización.
- **Un solo modelo alimenta UI y MCP.** El servidor MCP (REQ-090) no reimplementa nada: expone el
  mismo stream de `Overrun Events`. Diseñar este modelo ahora **prepara el MCP directamente**.
- El dominio **Security** entra en v2 (pentesting) sobre el mismo bus, sin rediseño.

El vertical slice mínimo que prueba la tesis: **REQ-001, 002, 010, 011, 012, 014, 020** sobre la
arquitectura **REQ-060 a 063, 065, 066** en **Windows + Linux (REQ-070)**. Es decir: un navegador
Electron que carga una página a tamaño completo, con un overlay flotante colapsable (que **no** toca
el viewport) alimentado por CDP a través de la capa de normalización `Overrun Events`, mostrando el
panel **Network** en tiempo real.
