import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installDevMock } from './lib/devMock'

if (import.meta.env.DEV) {
  installDevMock()
  // Dev-only handle for driving the app from automated checks.
  void import('./lib/store').then((m) => ((window as unknown as { __store: unknown }).__store = m.useStore))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
