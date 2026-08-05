import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Display: Unbounded — спортивный, «молодой», полная кириллица */
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
import '@fontsource/unbounded/800.css'
/* Brand: Syne — вытянутая латиница для Spotter */
import '@fontsource/syne/700.css'
import '@fontsource/syne/800.css'
/* Body: Manrope — читаемый UI */
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import App from './App'
import { SiteLockGate } from './components/SiteLockGate'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteLockGate>
      <App />
    </SiteLockGate>
  </StrictMode>,
)
