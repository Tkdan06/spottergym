import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ScrollToTop } from './ScrollToTop'

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const chatOpen = /^\/app\/messages\/[^/]+/.test(pathname)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type !== 'spotter:navigate' || typeof data.href !== 'string') return
      if (data.href.startsWith('/')) navigate(data.href)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [navigate])

  return (
    <div className={`app-shell has-nav ${chatOpen ? 'chat-open' : ''}`}>
      <ScrollToTop />
      {chatOpen ? null : <BottomNav />}
      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}
