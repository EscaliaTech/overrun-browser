# Multi Size

Selector de viewport de Overrun (REQ-003). Incluye **55 perfiles**, busqueda por
nombre o medidas, filtros por categoria, favoritos y hasta **50 perfiles propios**.

## Uso

1. Abri **Multi size** en la barra del navegador.
2. Busca un dispositivo o filtra por categoria; elegi una fila para aplicarlo.
3. Para medidas propias, completa ancho, alto, DPR y las opciones de layout
   movil / entrada tactil. **Aplicar tamano** activa esas medidas.
4. Para reutilizarlo, asigna un nombre y pulsa **Guardar**. Aparece en **Guardados**.
5. **Rotar** intercambia ancho y alto. **Ventana** elimina la emulacion y vuelve
   al espacio disponible bajo la barra.
6. **Aplicar y recargar** vuelve a solicitar la página con el User-Agent del
   perfil. `Ctrl/Cmd+Shift+M` abre el selector.

La estrella agrega o quita favoritos. Los perfiles guardados se eliminan con el
boton X de su fila y **E** permite editarlos. Importa/exporta perfiles propios
en JSON desde la sección de guardado. Escape cierra el panel; Tab recorre sus
controles.

## Medidas y emulacion

- Ancho y alto: enteros entre **200 y 7680 CSS px**, inclusive.
- DPR: **0.5 a 4**, admite valores fraccionarios como 2.625.
- Las dimensiones del catalogo son **viewports de referencia**, no resoluciones
  fisicas del panel. Los dispositivos pueden variar segun zoom, ajustes de
  pantalla, sistema operativo y barras del navegador.
- Si no cabe, la vista se centra y se escala automaticamente. Por ejemplo,
  3840 x 2160 sigue siendo el viewport logico aunque se muestre al 33%.
- El porcentaje es escala de visualizacion, no zoom del documento ni DPR.
- Rotar no cambia densidad, touch ni el modo movil. Elegir otro perfil recupera
  su orientacion base.
- El viewport activo sigue a la pestana seleccionada y se reaplica al navegar,
  cambiar de pestana, redimensionar la ventana o alternar la barra de bookmarks.
- El overlay no altera las dimensiones. Mientras el selector esta abierto, el
  chrome queda encima del overlay para que no tape sus controles.

## Catalogo

Fuente de verdad: `src/shared/viewport.ts`. Las medidas siguientes son las de la
orientacion base; cada perfil tambien puede rotarse.

| Categoria | Perfil | CSS px | DPR |
|---|---|---|---|
| Moviles | iPhone SE | 375 x 667 | 2 |
| Moviles | iPhone 12 / 13 mini | 375 x 812 | 3 |
| Moviles | iPhone 12 / 13 / 14 | 390 x 844 | 3 |
| Moviles | iPhone 14 Pro / 15 / 16 | 393 x 852 | 3 |
| Moviles | iPhone 14 Plus | 428 x 926 | 3 |
| Moviles | iPhone 15 Pro Max / 16 Plus | 430 x 932 | 3 |
| Moviles | iPhone 16 Pro | 402 x 874 | 3 |
| Moviles | iPhone 16 Pro Max | 440 x 956 | 3 |
| Moviles | Google Pixel 7 | 412 x 915 | 2.625 |
| Moviles | Google Pixel 8 | 412 x 915 | 2.625 |
| Moviles | Google Pixel 8 Pro | 448 x 998 | 3 |
| Moviles | Samsung Galaxy S24 | 360 x 780 | 3 |
| Moviles | Samsung Galaxy S24 Ultra | 384 x 824 | 3.75 |
| Moviles | Samsung Galaxy A54 | 360 x 800 | 3 |
| Plegables | Galaxy Z Fold5 / exterior | 344 x 882 | 2.625 |
| Plegables | Galaxy Z Fold5 / abierto | 690 x 829 | 3 |
| Plegables | Galaxy Z Flip5 / abierto | 412 x 915 | 2.625 |
| Plegables | Pixel Fold / exterior | 408 x 904 | 2.625 |
| Plegables | Pixel Fold / abierto | 841 x 701 | 2.625 |
| Tablets | iPad mini 5 | 768 x 1024 | 2 |
| Tablets | iPad mini 6 | 744 x 1133 | 2 |
| Tablets | iPad 10 / Air 11" | 820 x 1180 | 2 |
| Tablets | iPad Pro 11" (2018-2022) | 834 x 1194 | 2 |
| Tablets | iPad Pro 11" M4 | 834 x 1210 | 2 |
| Tablets | iPad Pro 13" M4 | 1032 x 1376 | 2 |
| Tablets | iPad Pro 12.9" | 1024 x 1366 | 2 |
| Tablets | Samsung Galaxy Tab S9 | 800 x 1280 | 2 |
| Tablets | Surface Pro / tactil | 912 x 1368 | 2 |
| Portatiles | Laptop compacta | 1280 x 800 | 1 |
| Portatiles | Laptop HD | 1366 x 768 | 1 |
| Portatiles | Laptop 1440 | 1440 x 900 | 1 |
| Portatiles | MacBook Air 13" | 1470 x 956 | 2 |
| Portatiles | MacBook Pro 14" | 1512 x 982 | 2 |
| Portatiles | MacBook Pro 16" | 1728 x 1117 | 2 |
| Portatiles | Laptop Full HD | 1920 x 1080 | 1 |
| Monitores | HD 720p | 1280 x 720 | 1 |
| Monitores | Monitor 1600 | 1600 x 900 | 1 |
| Monitores | Full HD 1080p | 1920 x 1080 | 1 |
| Monitores | QHD 1440p | 2560 x 1440 | 1 |
| Monitores | 4K UHD | 3840 x 2160 | 1 |
| Monitores | Ultrawide 21:9 | 3440 x 1440 | 1 |
| Monitores | Super ultrawide 32:9 | 5120 x 1440 | 1 |
| Monitores | 5K | 5120 x 2880 | 1 |
| TV | TV HD | 1280 x 720 | 1 |
| TV | TV Full HD | 1920 x 1080 | 1 |
| TV | TV 4K | 3840 x 2160 | 1 |
| TV | TV 8K | 7680 x 4320 | 1 |
| Breakpoints | XS / 320 | 320 x 568 | 1 |
| Breakpoints | Movil / 360 | 360 x 800 | 1 |
| Breakpoints | SM / 480 | 480 x 800 | 1 |
| Breakpoints | SM / 640 | 640 x 960 | 1 |
| Breakpoints | MD / 768 | 768 x 1024 | 1 |
| Breakpoints | LG / 1024 | 1024 x 768 | 1 |
| Breakpoints | XL / 1280 | 1280 x 800 | 1 |
| Breakpoints | 2XL / 1536 | 1536 x 960 | 1 |

## Alcance

Los perfiles moviles/tablets emulan metricas, touch y un User-Agent de referencia
mediante CDP; Surface usa layout desktop con touch. Los breakpoints solo cambian
las medidas y no activan touch ni UA movil.

El motor sigue siendo Chromium: **no simula Safari/WebKit, hardware, rendimiento
del dispositivo, areas seguras, bisagras, segmentos de pantalla ni Client Hints
completos**. Los perfiles TV son resoluciones, no emuladores de Smart TV.
Los personalizados conservan el UA del navegador aunque actives layout movil.
El UA afecta peticiones posteriores; recarga para volver a solicitar el documento.
En paginas sin meta viewport o con contenido que fuerza un layout mas ancho,
`innerWidth` puede ser distinto del ancho de pantalla emulado, como en un movil.

Favoritos y perfiles propios viven en el almacenamiento local del chrome
(`overrun.viewport-library.v1`), separado de la pagina inspeccionada. No se
sincronizan entre equipos ni entre los origenes de desarrollo y produccion.
El viewport activo y las pestañas se restauran al reiniciar desde la sesión local.
Esta entrega aplica **un tamano a la pestana activa**, no vistas simultaneas.

## Verificacion

```bash
bun run typecheck
bun run test:viewport
bun run test:viewport:electron
```

La prueba Electron compila la app y usa un perfil temporal y un servidor local,
sin modificar la sesion habitual. Requiere entorno grafico. Comprueba metricas
4K/movil/custom, DPR, touch, orientacion, recarga, bookmarks, cambio de pestana,
retorno a ventana, catálogo, busqueda, favoritos y guardados.
