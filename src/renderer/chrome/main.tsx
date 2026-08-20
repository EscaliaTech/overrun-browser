import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/fonts'
import '../shared/tokens.css'
import { Chrome } from './Chrome'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chrome />
  </StrictMode>
)
