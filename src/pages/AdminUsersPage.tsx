import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { searchFieldProps } from '../lib/inputAttrs'
import {
  ADMIN_PERMISSION_KEYS,
  ADMIN_PERMISSION_LABELS,
  ADMIN_PRESETS,
  FULL_PERMISSIONS,
  MODERATOR_PERMISSIONS,
  SUPPORT_PERMISSIONS,
  normalizeAdminPermissions,
  permissionSummary,
  type AdminPermissionPreset,
} from '../lib/adminPermissions'
import type { AdminDirectoryUser, AdminPermissions } from '../types'
import './FeedbackPage.css'
import './AdminUsersPage.css'

function permsOf(entry: AdminDirectoryUser): AdminPermissions {
  return normalizeAdminPermissions(entry.adminPermissions, {
    isAdmin: entry.isAdmin,
    isMasterAdmin: entry.isMasterAdmin,
    canGrantAdmin: entry.canGrantAdmin,
  })
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const {
    user,
    adminDirectory,
    blockedEmails,
    blockedIps,
    canManageAdmins,
    canBlockUsers,
    adminSetUserAdmin,
    adminSetPermissions,
    adminBlockEmail,
    adminUnblockEmail,
    adminBlockIp,
    adminUnblockIp,
  } = useApp()
  const [search, setSearch] = useState('')
  const [blockEmail, setBlockEmail] = useState('')
  const [blockIp, setBlockIp] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [appointPreset, setAppointPreset] = useState<AdminPermissionPreset>('support')

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return adminDirectory
      .filter((u) => !u.isDemoSeed)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
      .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, 'ru'))
  }, [adminDirectory, search])

  if (!user?.isAdmin) return <Navigate to="/app/profile" replace />
  if (!canManageAdmins && !canBlockUsers) return <Navigate to="/app/admin" replace />

  const onBlock = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    void (async () => {
      try {
        if (!blockEmail.trim()) return
        await adminBlockEmail(blockEmail)
        setBlockEmail('')
        setNotice('Email заблокирован')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })()
  }

  const onBlockIp = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    void (async () => {
      try {
        if (!blockIp.trim()) return
        await adminBlockIp(blockIp)
        setBlockIp('')
        setNotice('IP заблокирован')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })()
  }

  const togglePerm = (entry: AdminDirectoryUser, key: keyof AdminPermissions) => {
    if (!canManageAdmins || entry.isMasterAdmin) return
    const current = permsOf(entry)
    const next = { ...current, [key]: !current[key] }
    void (async () => {
      try {
        if (!entry.isAdmin) {
          await adminSetUserAdmin(entry.id, true, 'support')
        }
        await adminSetPermissions(entry.id, next)
        setNotice('Права обновлены')
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })()
  }

  const applyPreset = (entry: AdminDirectoryUser, preset: AdminPermissionPreset) => {
    const map = {
      support: SUPPORT_PERMISSIONS,
      moderator: MODERATOR_PERMISSIONS,
      full: user.isMasterAdmin
        ? FULL_PERMISSIONS
        : { ...FULL_PERMISSIONS, manageAdmins: false },
    } as const
    void (async () => {
      try {
        if (!entry.isAdmin) await adminSetUserAdmin(entry.id, true, preset)
        else await adminSetPermissions(entry.id, map[preset])
        setNotice(`Набор «${ADMIN_PRESETS.find((p) => p.id === preset)?.title}» применён`)
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })()
  }

  return (
    <main className="page admin-page admin-roles-page">
      <button type="button" className="back-link" onClick={() => navigate('/app/admin')}>
        <ArrowLeft size={18} /> Админка
      </button>
      <h1>Админы и права</h1>
      <p className="muted">
        Главный админ отмечен в списке. Можно выдать ограниченные права (только тикеты) или полные
        (блок, удаление, назначение других админов).
      </p>

      {canManageAdmins ? (
        <section className="admin-preset-help surface">
          <h2>Наборы прав при назначении</h2>
          <div className="admin-preset-pick">
            {ADMIN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`chip ${appointPreset === preset.id ? 'active' : ''}`}
                onClick={() => setAppointPreset(preset.id)}
              >
                {preset.title}
              </button>
            ))}
          </div>
          <p className="muted">
            {ADMIN_PRESETS.find((p) => p.id === appointPreset)?.hint}. Выбери набор, затем «Сделать
            админом» у пользователя.
          </p>
        </section>
      ) : (
        <p className="muted">У тебя нет права назначать админов — только просмотр своего уровня.</p>
      )}

      <button type="button" className="btn btn-ghost" onClick={() => navigate('/app/admin/players')}>
        Открыть пользователей и статистику
      </button>

      <input
        {...searchFieldProps}
        className="search-input"
        placeholder="Поиск по имени или email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="feedback-ticket-list">
        {list.map((entry) => {
          const perms = permsOf(entry)
          const open = expandedId === entry.id
          return (
            <div key={entry.id} className="admin-user-row">
              <div className="admin-role-head">
                <div>
                  <strong>
                    {entry.name}
                    {entry.isMasterAdmin ? ' · главный' : entry.isAdmin ? ' · админ' : ''}
                  </strong>
                  <p className="muted">{entry.email}</p>
                  <p className="dim">
                    {entry.isAdmin || entry.isMasterAdmin
                      ? permissionSummary(perms, entry.isMasterAdmin)
                      : 'Обычный пользователь'}
                  </p>
                </div>
                {canManageAdmins && !entry.isMasterAdmin ? (
                  <div className="actions">
                    <button
                      type="button"
                      className={`chip ${entry.isAdmin ? 'coach' : ''}`}
                      onClick={() => {
                        try {
                          adminSetUserAdmin(entry.id, !entry.isAdmin, appointPreset)
                          setNotice(
                            entry.isAdmin
                              ? 'Админ снят'
                              : `Админ назначен (${ADMIN_PRESETS.find((p) => p.id === appointPreset)?.title})`,
                          )
                          setError('')
                          if (!entry.isAdmin) setExpandedId(entry.id)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Ошибка')
                        }
                      }}
                    >
                      {entry.isAdmin ? 'Снять админа' : 'Сделать админом'}
                    </button>
                    {entry.isAdmin ? (
                      <button
                        type="button"
                        className="chip"
                        onClick={() => setExpandedId(open ? null : entry.id)}
                      >
                        {open ? 'Скрыть права' : 'Настроить права'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {entry.isAdmin && open && !entry.isMasterAdmin && canManageAdmins ? (
                <div className="admin-perm-panel">
                  <div className="admin-preset-pick">
                    {ADMIN_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="chip"
                        onClick={() => applyPreset(entry, preset.id)}
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                  <div className="admin-perm-grid">
                    {ADMIN_PERMISSION_KEYS.map((key) => {
                      const locked =
                        key === 'manageAdmins' && !user.isMasterAdmin
                      return (
                        <label
                          key={key}
                          className={`admin-perm-item ${locked ? 'is-locked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(perms[key])}
                            disabled={locked}
                            onChange={() => togglePerm(entry, key)}
                          />
                          <span>
                            <strong>{ADMIN_PERMISSION_LABELS[key].title}</strong>
                            <em>{ADMIN_PERMISSION_LABELS[key].hint}</em>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {entry.isMasterAdmin ? (
                <p className="dim">Главный админ всегда имеет полный доступ.</p>
              ) : null}
            </div>
          )
        })}
      </div>

      <section id="block" className="surface block-form">
        <h2>Блокировка по email</h2>
        {canBlockUsers ? (
          <>
            <p className="muted">Заблокированный email не сможет войти или зарегистрироваться.</p>
            <form onSubmit={onBlock} className="feedback-actions">
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={blockEmail}
                onChange={(e) => setBlockEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
              <button type="submit" className="btn btn-danger btn-block">
                Заблокировать
              </button>
            </form>
            <div className="chip-grid">
              {blockedEmails.length ? (
                blockedEmails.map((email) => (
                  <button
                    key={email}
                    type="button"
                    className="chip"
                    onClick={() => {
                      void (async () => {
                        try {
                          await adminUnblockEmail(email)
                          setNotice('Email разблокирован')
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Ошибка')
                        }
                      })()
                    }}
                  >
                    {email} · снять
                  </button>
                ))
              ) : (
                <p className="muted">Список блокировок пуст</p>
              )}
            </div>
          </>
        ) : (
          <p className="muted">У тебя нет права блокировать пользователей.</p>
        )}
      </section>

      <section id="block-ip" className="surface block-form">
        <h2>Блокировка по IP</h2>
        {canBlockUsers ? (
          <>
            <p className="muted">
              С заблокированного IP нельзя войти, зарегистрироваться или пользоваться API.
              Осторожно с общим Wi‑Fi зала.
            </p>
            <form onSubmit={onBlockIp} className="feedback-actions">
              <input
                name="ip"
                type="text"
                autoComplete="off"
                inputMode="decimal"
                value={blockIp}
                onChange={(e) => setBlockIp(e.target.value)}
                placeholder="203.0.113.10"
                required
              />
              <button type="submit" className="btn btn-danger btn-block">
                Заблокировать IP
              </button>
            </form>
            <div className="chip-grid">
              {blockedIps.length ? (
                blockedIps.map((ip) => (
                  <button
                    key={ip}
                    type="button"
                    className="chip"
                    onClick={() => {
                      void (async () => {
                        try {
                          await adminUnblockIp(ip)
                          setNotice('IP разблокирован')
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Ошибка')
                        }
                      })()
                    }}
                  >
                    {ip} · снять
                  </button>
                ))
              ) : (
                <p className="muted">Список IP-блокировок пуст</p>
              )}
            </div>
          </>
        ) : (
          <p className="muted">У тебя нет права блокировать пользователей.</p>
        )}
      </section>

      {notice ? <p className="feedback-notice">{notice}</p> : null}
      {error ? <p className="feedback-error">{error}</p> : null}
    </main>
  )
}
