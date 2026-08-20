# POR ACLARAR — registro vivo de decisiones

Registro de dudas y decisiones (resueltas + pendientes). Se actualiza a medida que avanza.

## Resueltas

| # | Decisión | Resolución | Dónde |
|---|---|---|---|
| D-001 | Base del navegador | **Electron + WebContentsView** para el MVP; CEF/fork descartados por costo/mantenimiento | [`../ingenieria/INVESTIGACION-BASE.md`](../ingenieria/INVESTIGACION-BASE.md) §3 |
| D-002 | Fuente de datos de métricas | **CDP** (Chrome DevTools Protocol), capa desacoplada de la base | INVESTIGACION-BASE §2 |
| D-003 | Overlay sin robar viewport | Segundo `WebContentsView` apilado en esquina, colapsable; página siempre full-size | INVESTIGACION-BASE §4 |
| D-004 | Lenguaje del shell | **TypeScript sobre Electron**; Tauri descartado (webview del SO, no Chromium → sin CDP real) | [`../ingenieria/LENGUAJE-Y-RENDIMIENTO.md`](../ingenieria/LENGUAJE-Y-RENDIMIENTO.md) §3 |
| D-005 | Código nativo | **Rust vía `napi-rs`** solo en hot paths y solo cuando el profiling lo justifique | LENGUAJE-Y-RENDIMIENTO §2, §5 |
| D-006 | IA / tokens de IA | **Diferido a v3.** Todo lo relacionado con IA queda fuera de v1/v2 | [`../producto/PRODUCTO.md`](../producto/PRODUCTO.md) |
| D-007 | Estrategia de optimización | **MVP = nivel 1 (runtime):** apagar features por switch (`--disable-features=`), modelo de procesos acotado, overlay lazy, trim de packaging (locales, asar). NO adelgazar el motor: el binario prebuilt de Electron no se puede recortar. Engine-strip (build propio de Chromium) **diferido** al tier CEF/fork, justificado por superficie de ataque mínima en la fase seguridad | [`../ingenieria/LENGUAJE-Y-RENDIMIENTO.md`](../ingenieria/LENGUAJE-Y-RENDIMIENTO.md) |
| D-008 | Branding del producto | **Brandear la app vía Electron** (nombre, ejecutable, icono, chrome frameless propio, instalador, opción de navegador default). El motor queda Chromium (invisible al usuario). Fork solo si algún día hay que brandear el motor (chrome://, UA total) — no es el caso | [`BRANDING.md`](BRANDING.md) |
| D-009 | Identidad de marca | Dark terminal / dev-tech. Space Grotesk (display/UI) + JetBrains Mono (data). Near-black `#0a0b0d`, acento oklch cyan primary + green/amber/red señal. Logo ▶ + wordmark. **Wordmark actual = `OVERRUN`** (codename, D-014); el sistema visual (mark ▶, tokens, tipos) no cambia con el rename | [`BRANDING.md`](BRANDING.md) · [concepto visual](https://claude.ai/code/artifact/90fe30b5-8a82-454e-a03c-1520bb514a24) |
| D-010 | Plataformas MVP | **Windows + Linux, sin firma de código.** macOS diferido (Gatekeeper bloquea lo no-notarizado → exige Apple Dev $99/año + hardware Mac). Windows sin cert = warning SmartScreen saltable; Linux = sin gate (AppImage). Arquitectura portable: lo OS-específico aislado tras capa fina, mac aditivo después. Ruta barata futura para matar el warning Win: Azure Trusted Signing (~$10/mes) | conversación |
| D-011 | Roadmap de versiones | **v1** = navegador + observabilidad (core). **v2** = pentesting / seguridad. **v3** = IA + servidor MCP | [`../producto/REQUERIMIENTOS.md`](../producto/REQUERIMIENTOS.md) |
| D-012 | Servidor MCP | Overrun expondrá un **servidor MCP** (control del navegador + datos de observabilidad, reusando la capa CDP de D-002) para usar el proyecto con asistentes IA (ej. Claude). En **v3**, junto a IA. Independiente de los paneles de IA → podría adelantarse | [`../producto/REQUERIMIENTOS.md`](../producto/REQUERIMIENTOS.md) REQ-090 |
| D-013 | Modelo de datos de observabilidad | Capa de **normalización** entre CDP y los consumidores: un stream de **eventos tipados por dominio** (`Overrun Events`, timestamped, esquema estable) que alimenta **UI y MCP** desde la misma fuente. Desacopla la UI del formato crudo de CDP y prepara el MCP sin reimplementar. Dominios: Network, Console, Memory, Performance, Storage (+ Security en v2) | [`../producto/REQUERIMIENTOS.md`](../producto/REQUERIMIENTOS.md) REQ-066 |
| D-024 | Versionado y repo | **SemVer atado al roadmap** (`0.x`→v1=`1.0.0`, v2=`2.0.0`, v3=`3.0.0`). **Conventional Commits**, sin co-author. Tags `vX.Y.Z` → GitHub Releases. Repo: `EscaliaTech/overrun-browser` (privado), `main` protegida, PRs, CI (typecheck+build) | [`../../README.md`](../../README.md) · [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) |
| D-016 | Stack de UI del overlay | **React + TypeScript.** Tablas virtualizadas (TanStack Virtual) para listas grandes (requests); **charts en Canvas con uPlot** (time-series). Regla: charts real-time en Canvas, **nunca SVG/DOM**. Encaja con D-004 (TS) | conversación |
| D-015 | Primer panel del MVP | **Network.** Vertical slice que ejercita todo el pipeline (CDP → Overrun Events → IPC → UI) y es la feature que más rápido demuestra el valor. Desglose en REQ-020 | [`../producto/REQUERIMIENTOS.md`](../producto/REQUERIMIENTOS.md) REQ-020 · [`../producto/ROADMAP.md`](../producto/ROADMAP.md) |
| D-014 | Nombre | **Codename interno `Overrun`** para distribución **interna** (sin trademark/dominio propio; palabra común + colisión con modo de juego + `.com` premium). Si se plantea **distribución pública → rename obligatorio**. Mantener el nombre en **un único punto de config** (`productName` en package.json + config de marca) para que el rename sea trivial (P-012) | [`BRANDING.md`](BRANDING.md) · conversación |
| D-017 | Click-through del overlay | **Toggle manual.** Por defecto el overlay captura clicks (es un panel); con tecla/botón se pasa a click-through para interactuar con la página debajo sin moverlo | REQ-013 |
| D-018 | Persistencia | **Memoria + export manual.** Métricas en memoria (se limpian al cerrar/navegar) con export de sesión: Network como **HAR**, resto como JSON. Sin persistencia en disco en v1 | REQ-080 |
| D-019 | User-Agent | **UA de Chrome intacto + token `Overrun/x.y`** appendeado. Máx compat + identificable | REQ-053 |
| D-020 | Navegador default del SO | **Opcional, off por defecto.** Puede registrarse (http/https), pero apagado de fábrica; lo activa el usuario | REQ-052 |
| D-021 | Alcance seguridad (v2) | **Arranca con CDP `Fetch`** (mini-Burp, sin salto de base). Proxy no-CDP (mitmproxy) se evalúa después según necesidad | REQ-040 · REQ-041 |
| D-022 | Distribución | **GitHub Releases**: AppImage (Linux) + instalador/exe (Windows). Gratis, sin dominio, encaja con interno/sin firma | REQ-073 |
| D-023 | Nombre público — timing | **Diferir la pasada de naming** hasta acercarse al release público. Codename `Overrun` sigue interno; el rename es trivial (config única). El gate queda como P-012 | P-012 |

## Pendientes

**Sin pendientes activos que bloqueen.** Fase 0 cerrada. Único gate futuro:

| # | Duda | Notas |
|---|---|---|
| P-012 | Nombre público definitivo | **Gate antes de distribución pública** (diferido por D-023). `Overrun` es codename interno (D-014). Al acercarse el release público: pasada de naming (trademark + dominio + sin colisión) y rename desde el punto único de config |

## Roadmap por versión (diferido)

**v2 — pentesting / seguridad**

| # | Tema | Notas |
|---|---|---|
| V-010 | Interceptar/modificar requests | CDP `Fetch`, estilo mini-Burp. REQ-040, P-005 |
| V-011 | Proxy no-CDP | Tipo mitmproxy para tráfico fuera de CDP (a evaluar). REQ-041, P-005 |
| V-012 | Superficie de ataque mínima | Build recortado del motor (posible salto a CEF/fork). REQ-042, D-007 |

**v3 — IA + MCP**

| # | Tema | Notas |
|---|---|---|
| V-001 | Tokens de IA | Panel de consumo de tokens en requests a LLM (`Fetch`/`Network`, parsear `usage`). REQ-030, D-006 |
| V-002 | Otras funcionalidades de IA | Cualquier feature de IA. REQ-031 |
| V-020 | Servidor MCP | Overrun como MCP: control del navegador + datos de observabilidad para Claude et al. REQ-090, D-012 |
