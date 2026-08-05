import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ScrollToTop } from './ScrollToTop'

export function AppLayout() {
  const { pathname } = useLocation()
  const chatOpen = /^\/app\/messages\/[^/]+/.test(pathname)

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
