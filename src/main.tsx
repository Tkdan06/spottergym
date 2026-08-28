import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Display: Unbounded — page titles, gym heroes, profile names */
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
import '@fontsource/unbounded/800.css'
/* Brand: Syne — вытянутая латиница для Spotter */
import '@fontsource/syne/700.css'
import '@fontsource/syne/800.css'
/* Body: Onest — основной UI */
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import App from './App'
import { EmergencyOfflineGate } from './components/EmergencyOfflineGate'
import { SiteLockGate } from './components/SiteLockGate'
import { currentUrlAfterNormalize } from './lib/normalizePathname'
import { startPwaViewportSync } from './lib/pwaViewport'
import { registerSpotterServiceWorker } from './lib/push'
import './styles/color-themes.css'
import './styles/global.css'
import './styles/sheets.css'

/** iOS “Add to Home Screen” sets navigator.standalone; CSS media covers Android PWAs. */
function markStandaloneLaunch() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const mq = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)')
  const apply = () => {
    const on = Boolean(nav.standalone) || mq.matches
    document.documentElement.classList.toggle('standalone', on)
  }
  apply()
  mq.addEventListener?.('change', apply)
}

markStandaloneLaunch()
try {
  const normalized = currentUrlAfterNormalize()
  if (normalized) window.history.replaceState(null, '', normalized)
} catch {
  /* ignore */
}
startPwaViewportSync()
void registerSpotterServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EmergencyOfflineGate>
      <SiteLockGate>
        <App />
      </SiteLockGate>
    </EmergencyOfflineGate>
  </StrictMode>,
)
