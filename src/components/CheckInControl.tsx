import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { getGym, getUserGyms } from '../data/mock'
import {
  canExtendCheckInLocal,
  CHECK_IN_MAX_EXTENDS,
  getCheckInExpiresAt,
  getCheckedInGymId,
  isCheckInExpiringSoon,
} from '../lib/presence'
import { useSheetA11y } from '../lib/sheetA11y'
import { useMoment } from './MomentFX'
import './CheckInControl.css'

interface Props {
  /** Зал текущего экрана — в него идём одним тапом */
  preferredGymId?: string
  compact?: boolean
  /** Full-width short labels (hall card) — no gym name in the button */
  block?: boolean
  className?: string
}

function shortGymName(name: string) {
  return name
    .replace(/^DDX\s+/i, '')
    .replace(/^Spirit\.?\s*Fitness\s*/i, '')
    .replace(/^World Class\s+/i, '')
    .replace(/^Encore\s+/i, '')
    .replace(/^Crocus Fitness\s+/i, '')
    .replace(/^XFIT\s+/i, '')
    .replace(/^Alex Fitness\s+/i, '')
    .replace(/^Fitness 24\s+/i, '')
    .trim()
}

function minutesLeftLabel(expiresAtIso: string) {
  const left = Date.parse(expiresAtIso) - Date.now()
  if (!Number.isFinite(left) || left <= 0) return 'скоро'
  const mins = Math.max(1, Math.ceil(left / 60_000))
  return `${mins} мин`
}

export function CheckInControl({ preferredGymId, compact, block, className = '' }: Props) {
  const { user, checkIn, checkOut, extendCheckIn } = useApp()
  const { celebrate } = useMoment()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [extending, setExtending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pop, setPop] = useState(false)
  const [, setTick] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useSheetA11y(sheetOpen, () => setSheetOpen(false), panelRef)

  // Refresh warning copy while checked in
  useEffect(() => {
    if (!user?.isActive) return
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [user?.isActive])

  if (!user) return null

  const gyms = getUserGyms(user)
  const checkedId = getCheckedInGymId(user)
  const checkedGym = checkedId ? getGym(checkedId) : undefined
  const targetId =
    (preferredGymId && user.gymIds.includes(preferredGymId) && preferredGymId) ||
    user.homeGymId ||
    user.gymIds[0] ||
    ''
  const targetGym = targetId ? getGym(targetId) : undefined
  const targetLabel = targetGym ? shortGymName(targetGym.name) || targetGym.name : ''
  const checkedLabel = checkedGym ? shortGymName(checkedGym.name) || checkedGym.name : ''
  const multi = gyms.length > 1
  const here = Boolean(user.isActive && checkedId && checkedId === targetId)
  const elsewhere = Boolean(user.isActive && checkedId && checkedId !== targetId)
  const expiringSoon = isCheckInExpiringSoon(user)
  const canExtend = canExtendCheckInLocal(user)
  const expiresAt = getCheckInExpiresAt(user)
  const extendsLeft = Math.max(0, CHECK_IN_MAX_EXTENDS - (user.checkInExtendCount || 0))

  if (!gyms.length || !targetId) {
    return (
      <button type="button" className={`btn btn-primary ${className}`} disabled>
        Сначала выбери зал
      </button>
    )
  }

  const run = async (
    fn: () => void | Promise<void>,
    moment?: 'checkin' | 'checkout',
  ) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await fn()
      if (moment) {
        setPop(true)
        window.setTimeout(() => setPop(false), 600)
        celebrate(moment)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус')
    } finally {
      setBusy(false)
    }
  }

  const pickGym = (gymId: string) => {
    void run(async () => {
      await checkIn(gymId)
      setSheetOpen(false)
    }, 'checkin')
  }

  const onExtend = async () => {
    if (extending || !canExtend) return
    setExtending(true)
    setError('')
    try {
      await extendCheckIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось продлить')
    } finally {
      setExtending(false)
    }
  }

  const errorLine = error ? (
    <p className="feedback-error checkin-error" role="alert">
      {error}
    </p>
  ) : null

  const sheet =
    sheetOpen && multi ? (
      <div className="app-sheet checkin-sheet" role="presentation">
        <button
          type="button"
          className="app-sheet-backdrop checkin-sheet-backdrop"
          aria-label="Закрыть"
          onClick={() => setSheetOpen(false)}
        />
        <div
          ref={panelRef}
          className="app-sheet-panel checkin-sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор зала"
        >
          <div className="app-sheet-grab checkin-sheet-grab" aria-hidden />
          <h3>Где отметиться?</h3>
          <p className="muted checkin-sheet-lead">Один тап — ты в этом зале · статус на 3 часа</p>
          <div className="checkin-sheet-list">
            {gyms.map((gym) => {
              const active = checkedId === gym.id && user.isActive
              const isTarget = gym.id === targetId
              return (
                <button
                  key={gym.id}
                  type="button"
                  className={`checkin-sheet-row ${active ? 'active' : ''}`}
                  onClick={() => pickGym(gym.id)}
                >
                  <span>
                    <strong>{shortGymName(gym.name) || gym.name}</strong>
                    <span className="dim">
                      {gym.network}
                      {isTarget ? ' · этот экран' : ''}
                    </span>
                  </span>
                  <span className="checkin-sheet-mark">{active ? 'Ты тут' : 'Выбрать'}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setSheetOpen(false)}>
            Отмена
          </button>
        </div>
      </div>
    ) : null

  const shellClass = [
    'checkin-control',
    compact ? 'compact' : '',
    block ? 'block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const shortLabels = Boolean(compact || block)
  const showExtras = !compact && !block

  /* Уже отмечен в этом зале */
  if (here) {
    return (
      <>
        <div className={shellClass}>
          {expiringSoon ? (
            <div className="checkin-expire-banner" role="status">
              <p>
                Статус снимется через {expiresAt ? minutesLeftLabel(expiresAt) : '30 мин'}
                {canExtend ? ' — ещё в зале?' : ''}
              </p>
              {canExtend ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={extending}
                  onClick={() => void onExtend()}
                >
                  {extending ? 'Продлеваем…' : `Ещё здесь · +1 ч`}
                </button>
              ) : (
                <p className="dim checkin-expire-note">Лимит продлений исчерпан — отметься заново</p>
              )}
              {canExtend && showExtras ? (
                <p className="dim checkin-expire-note">
                  Осталось продлений: {extendsLeft} из {CHECK_IN_MAX_EXTENDS}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={`btn btn-soft ${pop ? 'moment-btn-pop' : ''}`}
            disabled={busy}
            onClick={() => void run(() => checkOut(), 'checkout')}
          >
            Уйти
          </button>
          {errorLine}
          {multi && showExtras ? (
            <button type="button" className="checkin-other" onClick={() => setSheetOpen(true)}>
              Другой зал
            </button>
          ) : null}
          {showExtras ? (
            <p className="dim checkin-hint">
              Сейчас: {checkedLabel}
              {expiresAt && !expiringSoon
                ? ` · до ${new Date(expiresAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </p>
          ) : null}
        </div>
        {sheet}
      </>
    )
  }

  /* В зале, но смотришь другой клуб — один тап «сюда»; уйти — на экране своего зала */
  if (elsewhere) {
    return (
      <>
        <div className={shellClass}>
          <button
            type="button"
            className={`btn btn-primary ${pop ? 'moment-btn-pop' : ''}`}
            disabled={busy}
            onClick={() => void run(() => checkIn(targetId), 'checkin')}
          >
            {shortLabels ? 'Сюда' : `Перейти · ${targetLabel}`}
          </button>
          {errorLine}
        </div>
        {sheet}
      </>
    )
  }

  /* Не в зале — один тап в текущий клуб, без окна */
  return (
    <>
      <div className={shellClass}>
        <button
          type="button"
          className={`btn btn-primary ${pop ? 'moment-btn-pop' : ''}`}
          disabled={busy}
          onClick={() => void run(() => checkIn(targetId), 'checkin')}
        >
          {shortLabels ? 'Я в зале' : `Я в зале${targetLabel ? ` · ${targetLabel}` : ''}`}
        </button>
        {multi && showExtras ? (
          <button type="button" className="checkin-other" onClick={() => setSheetOpen(true)}>
            Другой зал
          </button>
        ) : null}
        {showExtras ? <p className="dim checkin-hint">Статус держится 3 часа, можно продлить</p> : null}
        {errorLine}
      </div>
      {sheet}
    </>
  )
}
