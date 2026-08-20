# Overrun — Documento maestro

## Qué es

**Overrun** (codename interno, ver [`../decisiones/BRANDING.md`](../decisiones/BRANDING.md)) es un
navegador web orientado a **desarrollo, debugging y testing** de aplicaciones
web. La tesis del producto: la **inspección y observabilidad forman parte de la experiencia de
navegación**, sin robarle espacio a la página.

En un navegador normal, abrir DevTools *dockeadas* encoge el viewport de render: dejás de ver tu
app a tamaño real justo cuando más necesitás observarla. Overrun resuelve esto poniendo las
herramientas en un **panel flotante / overlay** anclado a una esquina, por encima de la página,
colapsable. La superficie de render de la página se mantiene **siempre a tamaño completo**.

## Para quién

Desarrolladores front/full-stack, QA y, en fases posteriores, analistas de seguridad web que
quieren observabilidad continua sin alt-tabear entre la app y un panel de herramientas.

## Alcance (visión)

Panel flotante que muestra, en tiempo real:

- **Network** — requests, timings, tamaños, throughput, headers/payloads.
- **CPU / Rendimiento** — uso de CPU, long tasks, FPS, métricas de carga.
- **Memoria** — heap JS, contadores de DOM, detección de crecimiento.
- **Consola** — logs, warnings, errores, excepciones no capturadas.
- **Storage** — cookies, localStorage, sessionStorage, IndexedDB, cache.
- **Viewports / resoluciones** — probar la app en tamaños de dispositivo específicos.

Roadmap por versión:

- **v1** — navegador + observabilidad (core): navegación, overlay flotante, paneles de métricas,
  viewports, branding.
- **v2 — seguridad / pentesting** — interceptar y modificar requests, inspección de tráfico, checks
  de seguridad, superficie de ataque mínima.
- **v3 — IA + MCP** — panel de **tokens de IA** y features de IA, más un **servidor MCP** que
  expone Overrun (control del navegador + observabilidad) a asistentes como Claude.

## Principios de diseño

1. **El viewport es sagrado.** Nada de la instrumentación reduce el espacio de la página.
2. **Overlay, no ventana.** Las herramientas flotan sobre la navegación, no la interrumpen.
3. **Tiempo real.** Las métricas se ven mientras pasan, no en un volcado post-mortem.
4. **No intrusivo en la página.** La instrumentación vive fuera del DOM de la app (ver
   [`../ingenieria/INVESTIGACION-BASE.md`](../ingenieria/INVESTIGACION-BASE.md)), para no
   contaminar lo que se observa ni ser detectable — importante para el análisis de seguridad.

## Estado

Fase 0 — **investigación**. Ver [`../ingenieria/INVESTIGACION-BASE.md`](../ingenieria/INVESTIGACION-BASE.md)
para la evaluación técnica de la base (Electron vs. CEF vs. fork) y el mecanismo de datos (CDP).
Decisiones abiertas en [`../decisiones/POR-ACLARAR.md`](../decisiones/POR-ACLARAR.md).
