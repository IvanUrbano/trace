import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { cn } from '../lib/utils'

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

export function NotificationToast() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.21, 0.6, 0.35, 1] }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-[3px] border bg-paper px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)]',
                t.type === 'error' ? 'border-ink' : 'border-line',
              )}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 text-sm leading-snug">{t.message}</p>
              <button
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="text-muted transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
