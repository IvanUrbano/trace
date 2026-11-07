import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createScannerSession } from '../lib/scannerSession'
import { uid } from '../lib/utils'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

type Phase = 'idle' | 'permission' | 'starting' | 'scanning'

export function QRScanner({ onScan }: { onScan: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<HTMLDivElement | null>(null)
  const scannerRef = useRef<ReturnType<typeof createScannerSession> | null>(null)
  const stoppingRef = useRef<Promise<void>>(Promise.resolve())
  const mounted = useRef(true)

  const stopScanner = () => {
    const scanner = scannerRef.current
    const reader = readerRef.current
    scannerRef.current = null
    readerRef.current = null
    if (scanner) {
      // The library may still be awaiting permission. Keep its imperative host
      // attached until startup/stop completes, even after React removes the modal.
      if (reader) {
        const width = reader.parentElement?.clientWidth || 320
        Object.assign(reader.style, { position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, pointerEvents: 'none' })
        reader.setAttribute('aria-hidden', 'true')
        document.body.appendChild(reader)
      }
      stoppingRef.current = scanner.stop().catch(() => undefined).finally(() => reader?.remove())
    }
    return stoppingRef.current
  }

  const startScanner = async () => {
    if (scannerRef.current || !containerRef.current) return
    setPhase('starting')
    setError('')
    const reader = document.createElement('div')
    reader.id = uid('trace-qr-instance')
    containerRef.current.appendChild(reader)
    readerRef.current = reader
    const session = createScannerSession(async () => {
      await stoppingRef.current
      const { Html5Qrcode } = await import('html5-qrcode')
      return () => {
        const scanner = new Html5Qrcode(reader.id)
        return {
          start: async (decoded: (text: string) => void) => {
            await scanner.start(
              { facingMode: 'environment' },
              { fps: 10, qrbox: { width: 220, height: 220 } },
              decoded,
              () => { /* ignore per-frame decode errors */ },
            )
            // This library resolves start() before video.play() settles. Waiting
            // for playback prevents immediate cancellation from interrupting it.
            try {
              await reader.querySelector('video')?.play()
            } catch (error) {
              await scanner.stop()
              throw error
            }
          },
          stop: () => scanner.stop(),
          clear: () => scanner.clear(),
        }
      }
    }, (decodedText) => {
      void stopScanner()
      setOpen(false)
      onScan(decodedText)
    })
    scannerRef.current = session
    try {
      await session.ready
      if (mounted.current && scannerRef.current === session) setPhase('scanning')
    } catch (err) {
      if (!mounted.current || scannerRef.current !== session) return
      void stopScanner()
      setPhase('permission')
      setError(
        err instanceof Error && /permission|not allowed/i.test(err.message)
          ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
          : 'Unable to start the camera on this device. You can still open the item URL manually.',
      )
    }
  }

  useEffect(() => {
    if (!open) {
      void stopScanner()
      setPhase('idle')
      setError('')
    }
  }, [open])

  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void stopScanner()
    }
  }, [])

  const close = () => {
    void stopScanner()
    setOpen(false)
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} type="button">
        <ScanLine className="h-4 w-4" />
        Scan a QR Code
      </Button>
      <Modal open={open} onClose={close} title="Scan item QR code">
        <p className="mb-5 text-sm leading-relaxed text-muted">
          The camera opens only after you grant permission. Point it at a TRACE item QR code to
          jump straight to that item&apos;s page.
        </p>

        <div
          id="trace-qr-reader"
          ref={containerRef}
          className={`overflow-hidden rounded-[3px] border border-line bg-ink ${phase === 'scanning' || phase === 'starting' ? 'block' : 'hidden'}`}
          style={{ minHeight: 260 }}
        />

        {phase !== 'scanning' && phase !== 'starting' && (
          <div className="flex flex-col items-center rounded-[3px] border border-dashed border-line bg-mist/50 px-6 py-12 text-center">
            <Camera className="h-6 w-6 text-muted" strokeWidth={1.4} aria-hidden />
            <p className="mt-3 text-sm font-medium">Camera is off</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              Nothing is recorded. Scanning happens entirely in your browser.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-[3px] border border-line bg-mist p-3 text-sm" role="alert">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {phase === 'starting' && <p role="status" className="mr-auto text-sm text-muted">Starting camera…</p>}
          {phase === 'scanning' || phase === 'starting' ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void stopScanner()
                setPhase('idle')
              }}
            >
              Stop Camera
            </Button>
          ) : (
            <Button type="button" onClick={startScanner}>
              Grant Camera &amp; Start
            </Button>
          )}
        </div>
      </Modal>
    </>
  )
}
