<div align="center">

# ▶ Overrun

**El navegador donde la observabilidad es parte de navegar.**

Un navegador para **desarrollo, debugging y testing** con las DevTools integradas como un
**overlay flotante** que no le roba viewport a la página.

[![CI](https://github.com/EscaliaTech/overrun-browser/actions/workflows/ci.yml/badge.svg)](https://github.com/EscaliaTech/overrun-browser/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-0.1.0-35e0d0)
![status](https://img.shields.io/badge/status-MVP-blue)
![platform](https://img.shields.io/badge/plataforma-Windows%20%C2%B7%20Linux-2b303a)
![stack](https://img.shields.io/badge/Electron%20%C2%B7%20TypeScript%20%C2%B7%20React-0a0b0d)
![license](https://img.shields.io/badge/licencia-Propietaria-red)

</div>

> **Nota de nombre.** `Overrun` es un **codename interno**. El nombre público se define antes de
> la distribución pública (ver [`docs/decisiones/BRANDING.md`](docs/decisiones/BRANDING.md)).

---

## Qué es

En un navegador normal, abrir las DevTools *dockeadas* encoge el viewport: dejás de ver tu app a
tamaño real justo cuando más necesitás observarla. **Overrun** resuelve esto poniendo las
herramientas en un **panel flotante** anclado a una esquina, por encima de la página y colapsable.
La superficie de render se mantiene **siempre a tamaño completo**.

La instrumentación se obtiene por **Chrome DevTools Protocol (CDP)** desde fuera del DOM de la
página — no la contamina ni la modifica de forma observable, lo que además prepara el terreno para
el análisis de seguridad.

## Características (MVP)

- **Overlay flotante** de observabilidad — arrastrable, colapsable a un pill, **no altera el
  viewport** de la página.
- **Panel Network en tiempo real** — lista virtualizada de requests con method, status, tamaño y
  tiempo; **throughput** en Canvas.
- **Detalle de request** — General, **timing waterfall** (DNS/Connect/TLS/TTFB), headers de
  request y response, payload y body de respuesta (on-demand).
- **Chrome propio** — barra de direcciones, navegación y **resolución del viewport** en vivo.
- Sin barra de menú nativa; identidad visual propia (Space Grotesk + JetBrains Mono).

> **Concepto visual navegable:** [artboards de Overrun](https://claude.ai/code/artifact/90fe30b5-8a82-454e-a03c-1520bb514a24)
> (ventana, overlay colapsado, hoja de métricas, sistema de marca).

## Arquitectura

```
BaseWindow
├── chromeView   WebContentsView → barra + tabs (React)
├── pageView     WebContentsView → la app inspeccionada, full-size
└── overlayView  WebContentsView → panel flotante (React), colapsable

pageView ─CDP→ main ─→ Overrun Events (normalización) ─IPC→ overlayView (UI)
                                                        └──→ servidor MCP (v3)
```

La capa **Overrun Events** normaliza los eventos crudos de CDP en un stream tipado por dominio
(Network, Console, Memory, Performance, Storage). El mismo stream alimenta la UI hoy y el servidor
MCP en v3, sin reimplementar.

## Stack

| Pieza | Elección |
|---|---|
| Base | Electron + `WebContentsView` |
| Lenguaje | TypeScript |
| Datos | CDP 1.3 → capa `Overrun Events` |
| UI overlay | React + uPlot (Canvas) + TanStack Virtual |
| Bundler | electron-vite |
| Empaquetado | Windows (NSIS) + Linux (AppImage) |

## Desarrollo

Requiere **Node 20+**.

```bash
npm install
npm run dev          # modo desarrollo con HMR
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta la app en desarrollo |
| `npm run typecheck` | Chequeo de tipos (main + renderer) |
| `npm run build` | Bundle de producción |
| `npm run package:win` | Instalador NSIS (Windows) |
| `npm run package:linux` | AppImage (Linux) |

## Estructura

```
src/
├── shared/events.ts        Overrun Events (tipos por dominio) + canales IPC
├── main/                   proceso principal
│   ├── window.ts           BaseWindow + 3 WebContentsView + layout + IPC
│   ├── cdp/attach.ts       attach CDP a pageView
│   └── events/             bus + normalizadores por dominio
├── preload/                puente window.overrun (contextBridge, sandbox)
└── renderer/
    ├── chrome/             barra + tabs
    └── overlay/            panel de observabilidad
docs/                       producto, arquitectura, requerimientos, roadmap, decisiones
design/                     concepto visual (.dc.html)
```

## Roadmap

| Versión | Alcance |
|---|---|
| **MVP** ✅ | Navegador + overlay + panel Network end-to-end |
| **v1** | Paneles Console · Memory · CPU · Storage · viewports · branding · distribución |
| **v2** | Seguridad / pentesting (interceptar tráfico, superficie mínima) |
| **v3** | IA (tokens) + servidor MCP |

Detalle en [`docs/producto/ROADMAP.md`](docs/producto/ROADMAP.md).

## Documentación

Toda la documentación vive en [`docs/`](docs/) — empezar por [`docs/README.md`](docs/README.md).

## Versionado

**SemVer** atado al roadmap: `0.x` construye hacia v1; **v1 = `1.0.0`**, **v2 = `2.0.0`**,
**v3 = `3.0.0`**. Commits en formato **Conventional Commits**. Releases etiquetados `vX.Y.Z` con
binarios en GitHub Releases.

## Licencia

Propietario — © EscaliaTech. Todos los derechos reservados. Ver [`LICENSE`](LICENSE).
