import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/advanced-animations.js'

const isDesktopUi = window.matchMedia('(pointer: fine)').matches
if (isDesktopUi) {
  document.documentElement.classList.add('capture-safe')
}

// Must be set before Leaflet is imported to avoid 3D transforms that can disappear in OS screenshots.
;(window as Window & { L_DISABLE_3D?: boolean }).L_DISABLE_3D = true

void import('./App.tsx').then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
