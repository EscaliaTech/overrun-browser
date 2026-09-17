# Especificación de v2 y v3

Plan ejecutable para las fases posteriores a v1. No añade funcionalidades a la
release actual. Cada etapa tiene una salida verificable antes de abrir la siguiente.

## Principios no negociables

- El navegador solo opera sobre sistemas autorizados por el usuario.
- CDP sigue detrás de `Overrun Events`; ningún panel, regla ni MCP consume CDP
  directamente.
- Las acciones que modifican red, navegación, almacenamiento o ejecución tienen
  confirmación explícita, log de auditoría y alcance visible.
- Las respuestas, cookies, tokens y cuerpos de request se tratan como secretos:
  no salen de la máquina salvo exportación/acción explícita.
- La UI nunca ejecuta texto ni scripts recibidos de la página inspeccionada.

## v2: Seguridad y pentesting

### Objetivo

Convertir Overrun en un analizador de tráfico web autorizado, empezando por el
interceptor CDP `Fetch`. No incorpora un proxy MITM de inicio.

**Estado (2026-09-17):** 2.0 y 2.1 implementadas (panel Security en el overlay, reglas
locales y auditoría). 2.2 en adelante, sin empezar.

### Fase 2.0: Fundaciones de seguridad

**Salida:** dominio `security` versionado y panel funcional. **Estado: implementada**
(pendiente la batería de pruebas de protocolo).

| Entregable | Diseño | Estado | Dónde |
|---|---|---|---|
| Tipos `SecurityEvent` | `intercepted`, `modified`, `fulfilled`, `continued`, `blocked`, `timed-out`, `disabled`; `id`, método, URL, motivo, `ruleId` y `redacted` | ✓ | `src/shared/events.ts` |
| Permiso de sesión | Switch apagado por defecto + banner persistente “Modo interceptación activo” mientras dura | ✓ | `SecurityPanel.tsx` · `SecurityInterceptor.setEnabled` |
| Auditoría en memoria | Timeline con timestamp, fase, motivo y regla aplicada; se deriva del bus, no duplica estado en main | ✓ | `useSecurity.ts` |
| Export | JSON de sesión incluye reglas + auditoría **sin cuerpos** | ✓ | `exportSession.ts` |
| Redacción | Headers por patrón (`Authorization`, `Cookie`, `Set-Cookie`, `token`, …), claves sensibles en bodies JSON y form, tope de 256 kB | ✓ | `src/shared/security.ts` |

**Diferencias con el diseño original**

- La auditoría registra los valores resultantes de cada acción, no un diff lado a lado
  de la petición original contra la modificada. Queda para 2.2 si el uso lo pide.
- La lógica pura (redacción, reglas) vive en `src/shared/security.ts`: el renderer valida
  con el mismo código que aplica el main y las pruebas corren sin Electron.

**Pruebas:** ✓ redacción de headers y bodies, validación y matching de reglas
(`src/shared/security.test.ts`, en CI). ☐ normalización por fixture CDP de
`Fetch.requestPaused` y activación/desactivación durante requests concurrentes.

### Fase 2.1: Mini-Burp con CDP Fetch (REQ-040)

**Salida:** pausar, revisar, continuar, editar, responder o bloquear tráfico de la
pestaña activa. **Estado: implementada**, pendiente de verificación manual contra un
servidor de prueba.

| # | Diseño | Estado | Notas |
|---|---|---|---|
| 1 | `Fetch.enable` solo para patrones seleccionados, atado a la pestaña activa | ✓ | Los patrones se derivan de las reglas (`ruleUrlPatterns`); sin reglas el scope es `*`. Al cambiar de pestaña, `attachCdp.dispose()` libera la cola |
| 2 | `Fetch.requestPaused` → `security.intercepted` | ✓ | Descarta URLs no http(s) |
| 3 | Cola con límite y timeout seguro | ✓ | 50 pendientes, 15 s; al vencer continúa la petición y deja constancia (`timed-out`) |
| 4 | Inspector: URL, método, headers, body, respuesta y diff | Parcial | Editor de URL/método/headers/body. Sin vista de respuesta: solo se intercepta `requestStage: Request` |
| 5 | `continueRequest`, `fulfillRequest`, `failRequest` con confirmación en destructivas | ✓ | Bloquear y responder piden confirmación inline (nunca `confirm()` nativo: bloquearía el overlay) |
| 6 | Reglas locales por host/path/método en modo `observe`, `rewrite` o `block` | ✓ | Más `pause` (default implícito). Host exacto o `*.dominio`, path por prefijo. Toda regla automática emite su evento de auditoría |

**Validación local antes de tocar CDP:** URL http(s), método `[A-Z]{3,16}`, nombres de
header RFC-compatibles, tope de body y de cantidad de headers, status 100–599. El
renderer solo manda texto; el main nunca lo evalúa.

**Criterios de aceptación** — ☐ pendientes de correr a mano contra un servidor de prueba:

- ☐ Editar query/header/body de una petición y verificar que el servidor recibe el cambio.
- ☐ Bloquear un recurso y mostrar causa y regla aplicada.
- ☐ Desactivar el modo y comprobar que no quedan requests pausados.
- ☐ Navegar/cerrar pestaña durante una pausa sin fuga de listeners ni bloqueo.

**Fuera de alcance:** TLS interception, tráfico de extensiones/otras apps,
WebSocket frames modificables y proxy de sistema.

### Fase 2.2: Hallazgos y reportes

**Salida:** reglas pasivas explicables, no un scanner opaco.

Reglas iniciales:

- Cookies sin `Secure`, `HttpOnly` o `SameSite`.
- Respuestas con secretos potenciales mediante patrones configurables.
- Cabeceras de seguridad ausentes (`CSP`, `HSTS`, `X-Content-Type-Options`).
- Contenido mixto y redirects inseguros.

Cada hallazgo incluye evidencia redactada, severidad, URL, regla/versionado,
recomendación y falso positivo. Exporta JSON y Markdown; no exporta cuerpos sin
confirmación por hallazgo.

### Fase 2.3: Decisión de proxy no-CDP (REQ-041)

No se implementa por defecto. Se abre solo tras medir la necesidad con estas
preguntas:

1. ¿Qué tráfico autorizado falta respecto a CDP?
2. ¿CDP Fetch o DevTools Protocol ya cubren el caso?
3. ¿Se puede ejecutar un proceso aislado con CA efímera, revocación y consentimiento?
4. ¿El coste de soporte de certificados justifica el valor?

Si se aprueba: proceso auxiliar aislado, CA local explícita, no exportar clave,
lista de exclusión de dominios, proxy apagado por defecto y threat model antes de
escribir código.

### Fase 2.4: Superficie de ataque (REQ-042)

Primero hardening medible de Electron: actualización de runtime, permisos por
origen, CSP propia estricta, `contextIsolation`, sandbox, navegación controlada,
dependabot y SBOM. Evaluar CEF/fork solo si una auditoría demuestra que Electron
no puede cumplir el objetivo de superficie; es una decisión de arquitectura,
no una optimización prematura.

## v3: IA y MCP

### Objetivo

Exponer observabilidad y control del navegador de manera local, limitada y
auditable, y mostrar consumo real de APIs LLM sin inferir datos inventados.

### Fase 3.0: Contratos y seguridad MCP (REQ-090)

**Salida:** servidor MCP local de solo lectura.

| Elemento | Decisión |
|---|---|
| Transporte | stdio por defecto; HTTP local solo con token efímero y loopback |
| Sesiones | ID por ventana/pestaña; no usar IDs de CDP como API pública |
| Autorización | allowlist por herramienta + confirmación visual por acción mutante |
| Datos | schemas versionados derivados de `Overrun Events` |
| Límites | paginación, tamaño máximo de body, rate limit y cancelación |
| Auditoría | llamada, parámetros redactados, resultado, cliente y timestamp |

Herramientas iniciales de solo lectura:

- `tabs.list`, `page.get_state`, `network.list`, `network.get`, `console.list`,
  `performance.get`, `storage.summary`, `page.screenshot`.

**Criterios de aceptación:** un cliente MCP local lista requests y toma screenshot
sin acceso a cookies o cuerpos sensibles; toda llamada aparece en auditoría.

### Fase 3.1: Control MCP confirmado

Agregar de menor a mayor impacto:

1. `page.navigate`
2. `page.reload`
3. `page.click` y `page.type`
4. `network.intercept` (solo cuando v2 esté lista)

Las tres últimas muestran una tarjeta de aprobación que identifica cliente,
tab, selector/texto y destino. Permitido “aprobar una vez” o “siempre para esta
sesión”; nunca persistente por defecto.

### Fase 3.2: Panel de tokens IA (REQ-030)

1. Tabla de proveedores configurable: host, ruta, formato y versión.
2. Parseadores puros por proveedor, con fixtures de éxito, streaming, error y
   respuesta sin `usage`.
3. Clasificar `input`, `output`, `cached`, `reasoning` cuando el proveedor lo
   exponga; mostrar “no disponible” en vez de estimar.
4. Agregar por tab, origen, modelo y rango temporal; redacción por defecto.
5. Export JSON sin prompts/completions salvo consentimiento explícito.

Primeros proveedores: OpenAI Responses/Chat Completions y Anthropic Messages.
Los parseadores se versionan independientemente porque los schemas cambian.

### Fase 3.3: Otras funciones IA (REQ-031)

Propuestas a priorizar con evidencia de uso:

- Resumen local de errores/red, usando un proveedor elegido por el usuario.
- Explicación de waterfall y correlación de fallos.
- Generación de casos de prueba desde requests autorizadas.

No se envían datos a proveedores externos sin mostrar exactamente qué se envía,
origen, modelo y estimación de coste.

## Orden, estimación y gates

| Hito | Dependencia | Gate de salida |
|---|---|---|
| 2.0 | v1 estable | auditoría/redacción probadas — **implementado**, falta fixture CDP |
| 2.1 | 2.0 | no hay requests huérfanos ni bypass de permiso — **implementado**, falta verificación manual |
| 2.2 | 2.1 | hallazgos explicables y exportables |
| 2.3 | métricas reales de necesidad | threat model aprobado |
| 2.4 | paralelo | hardening y SBOM en CI |
| 3.0 | v1 + bus estable | cliente MCP local solo lectura |
| 3.1 | 3.0 | confirmación y auditoría de acciones |
| 3.2 | Network estable | fixtures por proveedor y no estimación engañosa |
| 3.3 | 3.2 | consentimiento explícito de envío |

Antes de cada hito se crea una amenaza específica, fixtures de protocolo y prueba
E2E. Antes de una distribución pública siguen aplicando el naming/trademark y
firma de código definidos en P-012 y REQ-072.
