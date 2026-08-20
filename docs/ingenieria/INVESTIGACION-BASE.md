# Investigación de base — sobre qué construir Overrun

Fase 0. Objetivo: decidir **sobre qué base** se construye Overrun y **de dónde salen los datos**
que alimentan el overlay de observabilidad, antes de escribir código de producto.

---

## 1. El problema técnico central

La tesis del producto (ver [`../producto/PRODUCTO.md`](../producto/PRODUCTO.md)) es que las
herramientas de inspección **no reduzcan el viewport**. Esto obliga a separar dos superficies:

1. **Superficie de página** — donde se renderiza la app del usuario, siempre a tamaño completo.
2. **Superficie de overlay** — el panel flotante de herramientas, por encima, colapsable.

Y a que los **datos** (network, CPU, memoria, etc.) se obtengan **sin inyectar nada en el DOM de
la página**. Inyectar scripts contaminaría lo que se observa y sería detectable — inaceptable para
la fase de seguridad. La respuesta a ambos requisitos es la misma: **usar Chromium de verdad y
hablarle por CDP** desde fuera de la página.

---

## 2. De dónde salen los datos: Chrome DevTools Protocol (CDP)

CDP es el protocolo que las propias DevTools de Chrome usan para hablar con el motor. Expone
cientos de métodos y eventos, **sin tocar el DOM de la página**. Todo navegador basado en Chromium
(Chrome, Edge, Brave, Opera, Vivaldi) lo habla — y es lo que usan Puppeteer, Playwright y el
Chrome DevTools MCP oficial de Google.

Mapa de necesidad → dominio CDP:

| Métrica del overlay | Dominio(s) CDP | Cómo |
|---|---|---|
| **Network** | `Network` | eventos `requestWillBeSent`, `responseReceived`, `loadingFinished`; headers, timings, tamaños |
| **CPU / Rendimiento** | `Performance`, `Profiler`, `Tracing` | `Performance.getMetrics` (polling); `.cpuprofile` para flame graphs; `Tracing` para long tasks/FPS |
| **Memoria** | `Runtime`, `Memory`, `HeapProfiler` | `Runtime.getHeapUsage`, `Memory.getDOMCounters`, snapshots vía `HeapProfiler.takeHeapSnapshot` |
| **Consola** | `Runtime`, `Log` | `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded` |
| **Storage** | `Storage`, `DOMStorage`, `IndexedDB`, `CacheStorage` | cookies (`Network.getCookies`), local/session storage, IndexedDB, caches |
| **Interceptar/modificar (pentesting)** | `Fetch` | pausar, reescribir o bloquear requests/responses — base de un mini-Burp |
| **Viewports / dispositivos** | `Emulation` | `setDeviceMetricsOverride`, user-agent, touch, geolocalización |
| **Tokens de IA** _(v2/v3, diferido)_ | `Fetch` / `Network` | interceptar requests a hosts LLM, parsear `usage`; **fuera de v1** |

**Conclusión:** CDP cubre el 100% de las métricas pedidas sin instrumentar la página. Es la capa de
datos, independientemente de la base que se elija en la sección 3.

---

## 3. Sobre qué base construir el navegador

Tres caminos reales para tener "un navegador Chromium propio":

### Opción A — Electron (Chromium bundled + Node)  ✅ recomendado para MVP

Electron empaqueta Chromium y Node.js en una app de escritorio. La página se renderiza en un
`WebContentsView` (proceso propio, Chromium real), y desde el proceso principal se le adjunta CDP
vía `webContents.debugger.attach()`.

- **Pros:** arranque rápido; ecosistema JS/Node enorme; CDP de primera clase; multiplataforma;
  es como están hechos VS Code, Slack, Teams, GitHub Desktop.
- **Contras:** peso en disco/RAM (trae Chromium entero); menos control de bajo nivel que C++.
- **Encaje con la tesis:** excelente. Ver mecánica del overlay en la sección 4.

### Opción B — CEF (Chromium Embedded Framework, C++/C#)

CEF embebe Chromium dentro de una app nativa (lo usan Spotify, Evernote).

- **Pros:** control nativo, mejor huella de recursos, C++/C#.
- **Contras:** CEF envuelve y **oculta** las APIs de Chromium para dar API estable — cuando
  necesitás llegar a lo de abajo, ese wrapper estorba (por eso Electron y NW.js terminaron usando
  las APIs de Chromium directo). Sin ecosistema Node. Costo de desarrollo mucho mayor.
- **Veredicto:** overkill para el MVP. Reconsiderar solo si la huella de recursos se vuelve
  bloqueante en producción.

### Opción C — Fork de Chromium

Compilar un Chromium propio con parches.

- **Pros:** control total, incluido el chrome de la UI a nivel motor.
- **Contras:** mantenimiento infernal — rebase continuo contra upstream, builds de horas,
  toolchain pesada. Es lo que hacen Brave/Vivaldi, con equipos dedicados.
- **Veredicto:** no para arrancar. Solo si Overrun creciera hasta necesitar cambios que ni CDP ni
  Electron permiten.

### Decisión

**Electron + `WebContentsView` + CDP** para el MVP. La **capa de datos (cliente CDP) se mantiene
desacoplada** de la base, de modo que si más adelante se migra a CEF o a un fork, la lógica de
métricas se reutiliza.

---

## 4. Mecánica del overlay que no roba viewport

En Electron, dentro de una misma `BrowserWindow` se apilan dos `WebContentsView` con z-order:

```
BrowserWindow
├── pageView     (WebContentsView)  → la app del usuario, bounds = ventana completa
└── overlayView  (WebContentsView)  → panel de herramientas, bounds = esquina, SIEMPRE encima
```

- `pageView` ocupa toda la ventana y **nunca se redimensiona** al abrir/cerrar herramientas.
- `overlayView` flota anclado a una esquina, colapsable a una burbuja; su UI (gráficos, tablas) se
  dibuja con web normal y se alimenta por **IPC** desde el proceso principal.
- El proceso principal mantiene el **cliente CDP** adjunto a `pageView.webContents`, se suscribe a
  los eventos de la sección 2 y los reenvía al `overlayView`.

Flujo de datos (con la capa de normalización — ver REQ-066 / D-013):

```
pageView (Chromium) ──CDP──► proceso principal ──► Overrun Events ──IPC──► overlayView (UI)
                                                   (normalización)   └────► servidor MCP (v3)
```

CDP no se conecta directo a cada panel: entre el protocolo y los consumidores va una capa que
convierte eventos crudos en **eventos tipados por dominio** (`Overrun Events`). Ese mismo stream
alimenta la UI y, en v3, el servidor MCP — sin reimplementar la lógica.

Así el overlay vive **fuera del DOM de la página**: no la contamina ni es detectable, y la página
conserva el viewport completo.

Modo dispositivo (opcional): para probar resoluciones específicas se usa `Emulation` de CDP o se
renderiza `pageView` a un ancho fijo centrado con marco — es un modo aparte, no el default.

---

## 5. Qué hace falta para el MVP (checklist)

**MVP implementado** (ver código en `src/`). Estado:

- [x] Shell Electron con ventana, barra de direcciones y navegación.
- [x] `pageView` (`WebContentsView`) a tamaño completo.
- [x] Adjuntar CDP a `pageView` (`webContents.debugger`, protocolo `1.3`).
- [x] `overlayView` flotante colapsable en esquina + puente IPC (+ arrastrable, resolución en la barra).
- [x] Primer panel end-to-end: **Network** (evento CDP → Overrun Events → IPC → tabla + detalle en overlay).
- [x] Desglose Network REQ-020: method, url, status, type, size, duration, timing (waterfall), headers, payload, response (on-demand), initiator, connection.
- [x] Menú nativo removido; fuentes de marca (Space Grotesk / JetBrains Mono) empaquetadas.

Siguiente (v1):

- [ ] Paneles Consola → Memoria → CPU/Rendimiento → Storage (mismo bus).
- [ ] Modo viewports/dispositivos (`Emulation`).
- [ ] (v2) interceptar/modificar requests con `Fetch`.
- [ ] _(v3, diferido)_ Panel de **tokens de IA** + servidor MCP — **fuera de v1**.

---

## 6. Antecedentes (qué existe y en qué se diferencia Overrun)

- **Polypane / Sizzy / Blisk** — navegadores de dev centrados en **múltiples viewports** sincronizados
  y herramientas de layout/accesibilidad. No resuelven el eje de Overrun: **observabilidad en tiempo
  real como overlay que no roba viewport**, ni el enfoque de tokens de IA / seguridad.
- **DevTools de Chrome** — completas pero *docked* (roban viewport) o en ventana aparte.
- **Chrome DevTools MCP / agent-cdp** — confirman que CDP expone todo lo necesario; validan la capa
  de datos elegida.

Overrun se diferencia en la **integración overlay + observabilidad continua + tokens IA + camino a
seguridad**, no en el multi-viewport (que sería una feature más, no la tesis).

---

## Fuentes

- [Mastering the Chrome DevTools Protocol (CDP)](https://martinuke0.github.io/posts/2026-03-23-mastering-the-chrome-devtools-protocol-cdp-a-deep-dive-for-web-engineers/)
- [Chrome DevTools MCP — Google](https://navoto.com/blog/chrome-devtools-mcp/)
- [agent-cdp (CDP CLI: heap, traces, CPU profiling)](https://github.com/callstackincubator/agent-cdp)
- [Electron Internals: Building Chromium as a Library](https://www.electronjs.org/blog/electron-internals-building-chromium-as-a-library)
- [Electron vs NW.js vs CEF — INTEGU](https://integu.net/electron-vs-nw-js-node-webkit-vs-cef-chromium-embedded-framework/)
- [Chromium Embedded Framework — Wikipedia](https://en.wikipedia.org/wiki/Chromium_Embedded_Framework)
- [Polypane — docs](https://polypane.app/docs/)
- [Sizzy vs Polypane](https://www.saashub.com/compare-sizzy-vs-polypane)
