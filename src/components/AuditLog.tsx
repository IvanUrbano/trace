import { useStore } from '../lib/store'
import { relativeTime } from '../lib/utils'

export function AuditLog() {
  const { audit } = useStore()
  return (
    <section aria-labelledby="audit-heading">
      <h2 id="audit-heading" className="text-lg font-semibold tracking-tight">
        Audit history
      </h2>
      <p className="mt-1 text-sm text-muted">
        Append-only record of every important action. Entries cannot be edited or removed.
      </p>
      <ol className="mt-6 overflow-hidden rounded-[4px] border border-line">
        {audit.map((entry, i) => (
          <li
            key={entry.id}
            className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
              i % 2 ? 'bg-mist/50' : 'bg-paper'
            } ${i > 0 ? 'border-t border-line' : ''}`}
          >
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{entry.action}</p>
              <p className="mt-0.5 text-sm font-medium">{entry.target}</p>
              {entry.detail && <p className="mt-0.5 text-xs text-muted">{entry.detail}</p>}
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-sm">{entry.actor}</p>
              <p className="mt-0.5 text-xs text-muted">{relativeTime(entry.timestamp)}</p>
            </div>
          </li>
        ))}
        {audit.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-muted">No audit entries yet.</li>
        )}
      </ol>
    </section>
  )
}
