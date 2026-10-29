import { FileCheck2, ShieldQuestion, ScrollText } from 'lucide-react'
import { Divider, RevealOnScroll, StaggerContainer, StaggerItem } from '../motion'

const features = [
  {
    icon: ShieldQuestion,
    title: 'Private ownership questions',
    description:
      'Only the true owner can answer the small details that never appear in a public listing.',
  },
  {
    icon: FileCheck2,
    title: 'Human-reviewed claims',
    description:
      'Authorized reviewers compare answers before an item changes hands. Nothing is auto-approved.',
  },
  {
    icon: ScrollText,
    title: 'Traceable handoff records',
    description:
      'Every approval, decline, and return is recorded so the full journey stays accountable.',
  },
]

export function TrustVerification() {
  return (
    <section className="bg-ink py-24 text-paper lg:py-32" aria-labelledby="trust-heading">
      <div className="container-x">
        <RevealOnScroll>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-paper/50">
            Trust &amp; Verification
          </p>
          <h2 id="trust-heading" className="h2-section mt-4 max-w-2xl">
            Finding it is only half the story.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-paper/70">
            Before an item changes hands, ownership must be verified. Every important action is
            recorded to help keep the process accountable.
          </p>
        </RevealOnScroll>
        <Divider className="mt-12 border-paper/15" />
        <StaggerContainer className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12" staggerDelay={0.12}>
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <f.icon className="h-6 w-6" strokeWidth={1.4} aria-hidden />
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper/60">{f.description}</p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
