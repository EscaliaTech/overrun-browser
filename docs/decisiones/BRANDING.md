# BRANDING — Overrun (codename)

> **Nombre:** el producto usa el codename interno **`Overrun`** (D-014). Es solo para distribución
> interna; si se plantea distribución pública hay que renombrar (P-012). El **sistema visual de
> abajo no cambia con el rename** — solo cambia el texto del wordmark. Mantener el nombre en un
> único punto de config (`productName` + config de marca) para que el rename sea trivial.

Identidad de marca del producto y cómo se aplica en Electron. Concepto visual navegable:
[artboards del navegador](https://claude.ai/code/artifact/90fe30b5-8a82-454e-a03c-1520bb514a24)
(ventana con overlay, overlay colapsado, hoja de métricas, sistema de marca).

## Dirección

**Dark terminal / dev-tech.** Se ve como una herramienta de dev seria: superficies
casi-negras, tipografía mono para datos, un acento cian que señala "vivo / activo". Sobrio, denso
donde importa, sin adornos.

Tagline: **"Observability is part of browsing."**

## Sistema visual

### Tipografía
- **Space Grotesk** — display / UI (títulos, chrome, etiquetas). Fallback: `system-ui, sans-serif`.
- **JetBrains Mono** — datos / código / métricas / wordmark. Fallback: `ui-monospace, monospace`.

### Color (tokens)

| Token | Valor | Uso |
|---|---|---|
| Void | `#0a0b0d` | fondo base |
| Surface | `#14161b` | paneles, address bar, chips |
| Line | `#262a32` | bordes / divisores |
| Text | `#e6e8ea` | texto primario |
| Dim | `#8a9099` | texto secundario |
| **Cyan · primary** | `oklch(0.82 0.15 195)` | acento principal, "vivo/activo", glow |
| Green · ok | `oklch(0.82 0.15 150)` | estados OK (200, CDP attached) |
| Amber · warn | `oklch(0.82 0.15 85)` | warnings |
| Signal · alert | `oklch(0.70 0.19 25)` | errores / alertas (401, long tasks) |

Regla de acentos: comparten chroma/lightness, varían hue (oklch). El **cian se reserva** para
señal de actividad/live — no pintar todo de cian o se diluye.

### Logo
- Mark: triángulo ▶ (ejecución / "run") en un cuadrado-terminal redondeado con glow cian; tick de
  scanline verde.
- Wordmark: **OVERRUN** en JetBrains Mono 700, letter-spacing ~0.16em (texto reemplazable en el
  rename; ver nota de nombre arriba).
- Variantes: primaria (mark + wordmark sobre oscuro), mark solo, sobre claro, monocromo.

### Iconografía
- Solo **SVG inline** stroke-based (grid 16/20/24). **Nunca** emoji ni glyphs unicode como iconos.

## Aplicación en Electron

La marca se aplica a la **app**, no al motor (que queda Chromium, invisible). Ver decisión D-008.

| Superficie | Cómo |
|---|---|
| Nombre de producto / ejecutable | `productName` en `package.json` (`Overrun`, `Overrun.exe`) — punto único para el rename |
| Icono (taskbar, tray, `.exe`, instalador) | assets `.ico`/`.icns`/`.png` + electron-builder |
| Ventana | frameless + chrome propio en HTML (tabs, toolbar, address bar) |
| Menú / panel "About" / nombre en dock-taskbar | `app.name`, menú custom |
| Instalador (NSIS / dmg) | electron-builder: nombre, licencia, fondo, atajos |
| App User Model ID (agrupado en taskbar Win) | `app.setAppUserModelId('...')` |
| Protocolo `overrun://` y navegador default | `app.setAsDefaultProtocolClient()` (ver P-010) |
| User-Agent | mantener token `Chrome` por compat + `Overrun/x.y` (ver P-009) |

### Lo que queda Chromium (no se brandea sin fork)
Páginas internas `chrome://…`, `about:credits`, token de motor en el UA, nombre de helper
processes. Invisible al usuario normal; se puede tapar con páginas internas propias. Brandear esto
solo justificaría un fork — no es el caso.

## Do / Don't
- **Do:** cian = actividad/live; SVG inline; mono para datos; near-black; densidad donde aporta.
- **Don't:** gradientes gratuitos, emoji como icono, cian en todo, inventar colores fuera de oklch,
  fuentes genéricas (Inter/Roboto/Arial).
