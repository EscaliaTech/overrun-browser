# Lenguaje y rendimiento

Fase 0. Decidir en qué lenguaje se escribe Overrun, con foco en rendimiento y optimización.
Depende de la decisión de base (D-001) en [`INVESTIGACION-BASE.md`](INVESTIGACION-BASE.md).

---

## 1. Dónde está realmente el costo de rendimiento

Antes de elegir lenguaje, hay que ubicar el costo. En Overrun el trabajo pesado **no lo pone
nuestro código**:

- **Renderizar páginas, correr el JS de la app observada, layout, stack de red** → lo hace
  **Chromium**, que es C++, independientemente del lenguaje del shell.
- **Nuestro código** hace: manejar eventos CDP, reenviarlos por IPC, y dibujar el overlay. Eso es
  **I/O asíncrono + procesamiento liviano**, no cómputo intensivo.

Por eso, elegir un lenguaje "más rápido" para el shell **no mueve la aguja** en el grueso del
rendimiento. Los bottlenecks reales son:

1. **Volumen de eventos CDP** — una página activa emite miles de eventos `Network`/`console`.
2. **Render del overlay** — gráficos actualizándose a ~60 fps.
3. **RAM** — dos vistas Chromium (`pageView` + `overlayView`) más nuestro proceso.

Ninguno se resuelve reescribiendo el shell en un lenguaje de sistemas; se resuelven con
**arquitectura** (batching, agregación, GPU para charts, mantener el observador fuera del proceso
observado).

---

## 2. Dónde sí ayuda código nativo (hot paths)

Hay tareas puntuales, intensivas en CPU/memoria, donde un lenguaje nativo (Rust) rinde de verdad:

- **Heap snapshots** — CDP los emite como JSON enorme (cientos de MB); parsearlos en JS es lento y
  presiona el GC. Ideal en un worker Rust.
- **Agregación de streams CDP de alta frecuencia** — buffers en anillo, deduplicación, métricas
  rodantes sobre miles de eventos/seg.
- **Proxy / inspección de tráfico (fase seguridad)** — parseo de paquetes, TLS, interceptación de
  gran volumen.
- _(v2/v3, diferido)_ **Conteo de tokens de IA** — tokenizar payloads sin bloquear el hilo de UI.
  Fuera de v1.

La estrategia es **híbrida**: shell en lenguaje productivo, hot paths en nativo, y solo **cuando el
profiling lo justifique** — no antes (evitar optimización prematura).

---

## 3. Opciones

| Stack | Lenguaje del shell | ¿Chromium real? | CDP | Hot paths nativos | Veredicto |
|---|---|---|---|---|---|
| **Electron + TS (+ Rust addons)** | TypeScript/JS | bundled ✅ | nativo ✅ | Rust vía `napi-rs` | ✅ **MVP** |
| Tauri + Rust | Rust | ❌ webview del SO (WebView2/WebKitGTK), no Chromium | pobre / indirecto | Rust | ❌ rompe la tesis |
| CEF + C++/C# | C++ / C# | embedded ✅ | ✅ | native en todo | costo de desarrollo enorme |
| Fork de Chromium | C++ | es Chromium | ✅ | native | mantenimiento infernal |

### Por qué **no** Tauri (pese a ser el "rápido/liviano")

Tauri es tentador por rendimiento y tamaño de binario, pero usa el **webview del sistema**
(WebView2 en Windows, WebKitGTK en Linux, WebKit en macOS), **no un Chromium controlable**. Eso
significa:

- CDP no está disponible de forma uniforme ni completa → se cae la capa de datos del producto.
- Para tener Chromium real habría que **bundlearlo aparte** y manejarlo por CDP como sidecar,
  perdiendo justo la ventaja de tamaño de Tauri.

El producto **exige Chromium real + CDP** (ver INVESTIGACION-BASE §2), así que Tauri queda fuera.

### Por qué **sí** Electron + TS, con Rust opcional

- TypeScript da velocidad de desarrollo, tipado, y el ecosistema JS/Node (donde vive el soporte CDP
  de primera clase).
- El "peso" de Electron es esencialmente el de Chromium, que necesitamos igual.
- VS Code demuestra que Electron sostiene una dev-tool exigente en rendimiento.
- `napi-rs` permite compilar módulos Rust a addons nativos (N-API, ABI estable) y llamarlos desde
  TS de forma asíncrona, **sin bloquear** el hilo de JS — se meten justo en los hot paths de §2.

---

## 4. Modelo de procesos (para no ser el cuello de botella)

Principio de **efecto observador**: la instrumentación no debe frenar la app observada.

- `pageView` corre en su(s) proceso(s) Chromium propio(s).
- El cliente CDP y la agregación viven en el **proceso principal** o en un **worker/util process**
  aparte, **nunca** dentro del proceso de la página.
- Los addons Rust corren su trabajo pesado fuera del hilo de UI (worker pool de N-API).
- El overlay dibuja con canvas/WebGL acelerado por GPU en su propio renderer.

```
pageView (Chromium, aislado)
      │ CDP
      ▼
proceso principal / util process (TS)  ──►  addons Rust (heap, agregación, tokens)
      │ IPC
      ▼
overlayView (renderer, charts GPU)
```

---

## 5. Decisión

- **Lenguaje del MVP:** **TypeScript sobre Electron.**
- **Nativo:** **Rust vía `napi-rs`**, introducido **solo cuando el profiling identifique un hot
  path real** (heap snapshots probablemente el primero).
- **Capa de datos (CDP) desacoplada** para que un eventual cambio de base (CEF/fork) reutilice la
  lógica.

Ver decisiones D-004 y D-005 en [`../decisiones/POR-ACLARAR.md`](../decisiones/POR-ACLARAR.md).
