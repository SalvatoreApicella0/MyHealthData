import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'

const container = document.getElementById('root')

if (!container) {
  throw new Error('MyHealthData root container is missing')
}

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)

// Offline-first: the vault keeps working with no network connection.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch(() => {
        // A missing service worker must never block the app.
      })
  })

  // The Hub ships a new build with every app update: reload once when the new
  // worker takes control so the UI is never a stale cached frame.
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || window.sessionStorage.getItem('mhd.sw-reload') === '1') return
    reloaded = true
    window.sessionStorage.setItem('mhd.sw-reload', '1')
    window.location.reload()
  })
}
