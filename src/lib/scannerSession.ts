export interface ScannerAdapter {
  start: (onDecoded: (text: string) => void) => Promise<void>
  stop: () => Promise<void>
  clear: () => void
}

/** Cancellation also covers a pending library import or camera permission prompt. */
export function createScannerSession(
  load: () => Promise<() => ScannerAdapter>,
  onDecoded: (text: string) => void,
) {
  let active = true
  let scanner: ScannerAdapter | undefined
  let started = false
  let cleanup: Promise<void> | undefined
  const dispose = () => cleanup ??= (async () => {
    if (!scanner) return
    try {
      if (started) await scanner.stop()
    } finally {
      scanner.clear()
    }
  })()

  const ready = (async () => {
    const create = await load()
    if (!active) return
    scanner = create()
    try {
      await scanner.start((text) => { if (active) onDecoded(text) })
      started = true
    } finally {
      if (!active || !started) await dispose()
    }
  })()

  return {
    ready,
    stop: async () => {
      active = false
      await ready.catch(() => undefined)
      await dispose()
    },
  }
}
