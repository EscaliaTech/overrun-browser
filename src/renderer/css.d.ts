import 'csstype'

declare module 'csstype' {
  // Zona de arrastre de la ventana frameless (Electron): no está en el tipo base
  // de csstype, así que se agrega acá para usarla en estilos inline.
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
