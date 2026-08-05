import { Dumbbell, MessageCircle, Search, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useApp } from '../context/useApp'
import './BottomNav.css'

const items = [
  { to: '/app', label: 'Мой зал', icon: Dumbbell, end: true },
  { to: '/app/discover', label: 'Залы', icon: Search },
  { to: '/app/messages', label: 'Чаты', icon: MessageCircle },
  { to: '/app/profile', label: 'Профиль', icon: UserRound },
]

export function BottomNav() {
  const { conversations } = useApp()
  const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <span className="nav-icon-wrap">
            <Icon size={22} strokeWidth={2.1} />
            {label === 'Чаты' && unread > 0 ? <i className="nav-badge">{unread}</i> : null}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
