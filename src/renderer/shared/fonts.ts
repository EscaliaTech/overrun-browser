// Fuentes de marca empaquetadas (BRANDING / D-009). @fontsource bundlea los
// woff2 como assets locales → sirve bajo 'self', respeta la CSP (sin host externo).
// La UI está en español/inglés: incluir solo latin evita empaquetar los subsets
// cirílico, griego y vietnamita en cada renderer.
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-600.css'
import '@fontsource/jetbrains-mono/latin-700.css'
