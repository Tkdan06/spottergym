import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import {
  createWorkoutShareFile,
  workoutSharePreviewUrl,
  type WorkoutShareCardData,
} from '../lib/workoutShareCard'
import { useSheetA11y } from '../lib/sheetA11y'
import './WorkoutShareSheet.css'

type Props = {
  open: boolean
  data: WorkoutShareCardData
  onClose: () => void
}

function download(file: File) {
  const href = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = file.name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(href), 0)
}

export function WorkoutShareSheet({ open, data, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const previewUrl = useMemo(() => workoutSharePreviewUrl(data), [data])

  useSheetA11y(open, onClose, panelRef)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPreparing(true)
    setError('')
    setFile(null)
    void createWorkoutShareFile(data)
      .then((next) => {
        if (!cancelled) setFile(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось подготовить изображение')
      })
      .finally(() => {
        if (!cancelled) setPreparing(false)
      })
    return () => {
      cancelled = true
    }
  }, [data, open])

  const share = async () => {
    if (!file) return
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'Моя тренировка в Spotter' })
        return
      }
      download(file)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Не удалось открыть меню «Поделиться»')
    }
  }

  if (!open) return null
  return (
    <div className="app-sheet workout-share-sheet" role="dialog" aria-modal="true" aria-labelledby="workout-share-title">
      <button type="button" className="app-sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="app-sheet-panel workout-share-panel" ref={panelRef}>
        <div className="app-sheet-grab" aria-hidden />
        <h3 id="workout-share-title">Поделиться тренировкой</h3>
        <p className="muted">Карточка создаётся только на твоём устройстве.</p>
        <img className="workout-share-preview" src={previewUrl} alt="Карточка тренировки для Stories" />
        {error ? <p className="feedback-error" role="alert">{error}</p> : null}
        <button type="button" className="btn btn-primary btn-block" disabled={!file || preparing} onClick={() => void share()}>
          <Share2 size={16} /> {preparing ? 'Готовим картинку…' : 'Поделиться'}
        </button>
        <button type="button" className="sheet-action" disabled={!file || preparing} onClick={() => file && download(file)}>
          <Download size={16} /> Сохранить картинку
        </button>
      </div>
    </div>
  )
}
