import { useReducedMotion } from 'framer-motion'

const words = [
  'Wallets',
  'Headphones',
  'Keys',
  'Backpacks',
  'Laptops',
  'Water bottles',
  'Cameras',
  'Sunglasses',
  'Tote bags',
  'Watches',
]

export function Marquee() {
  const reduce = useReducedMotion()
  const row = [...words, ...words]
  return (
    <section className="overflow-hidden border-b border-line bg-paper py-5" aria-label="Common item categories">
      <div
        className={`flex w-max gap-10 ${reduce ? 'animate-none' : 'animate-[marquee_38s_linear_infinite]'}`}
        style={
          reduce
            ? undefined
            : { animation: 'marquee 38s linear infinite', willChange: 'transform' }
        }
      >
        {row.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="flex shrink-0 items-center gap-10 text-sm font-medium uppercase tracking-[0.2em] text-muted"
            aria-hidden={i >= words.length}
          >
            {w}
            <span className="h-1 w-1 rounded-full bg-line" aria-hidden />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
