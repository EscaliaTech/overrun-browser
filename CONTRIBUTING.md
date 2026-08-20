# Contribuir a Overrun

## Flujo

1. Rama corta desde `main`: `feat/…`, `fix/…`, `docs/…`.
2. Cambios + `npm run typecheck` y `npm run build` en verde.
3. PR contra `main` (la plantilla se completa sola).

## Commits — Conventional Commits

```
<tipo>(<alcance opcional>): <resumen en minúscula, imperativo>
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `test`, `perf`, `style`.

Ejemplos:

```
feat(overlay): panel Network con detalle de request
fix(cdp): limpiar estado de red al navegar
docs: agregar roadmap por fases
```

Referenciá el requerimiento o decisión cuando aplique (`REQ-020`, `D-013`).

## Versionado

SemVer atado al roadmap: `0.x` → v1 (`1.0.0`) → v2 (`2.0.0`) → v3 (`3.0.0`).
Releases etiquetados `vX.Y.Z`.

## Estilo

- TypeScript estricto. Dos espacios de indentación (ver `.editorconfig`).
- La UI no confía en el contenido de la página inspeccionada: la instrumentación vive fuera de su
  DOM/JS (CDP).
