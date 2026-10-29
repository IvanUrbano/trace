import { Camera, CameraOff, ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

type Phase = 'idle' | 'permission' | 'scanning' | 'unsupported'

export function QRScanner({ onScan }: { onScan: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)

  const stopScanner = async () => {
    try {
      await scannerRef.current?.stop()
    } catch {
      /* already stopped */
    }
    scannerRef.current = null
  }

  const startScanner = async () => {
    setPhase('scanning')
    setError('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('trace-qr-reader')
      scannerRef.current = scanner as unknown as { stop: () => Promise<void> }
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onScan(decodedText)
          setOpen(false)
          void stopScanner()
        },
        () => {
          /* ignore per-frame decode errors */
        },
      )
    } catch (err) {
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

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} type="button">
        <ScanLine className="h-4 w-4" />
        Scan a QR Code
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Scan item QR code">
        <p className="mb-5 text-sm leading-relaxed text-muted">
          The camera opens only after you grant permission. Point it at a TRACE item QR code to
          jump straight to that item&apos;s page.
        </p>

        <div
          id="trace-qr-reader"
          ref={containerRef}
          className={`overflow-hidden rounded-[3px] border border-line bg-ink ${phase === 'scanning' ? 'block' : 'hidden'}`}
          style={{ minHeight: 260 }}
        />

        {phase !== 'scanning' && (
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
          {phase === 'scanning' ? (
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await stopScanner()
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
