import { QRCodeSVG } from 'qrcode.react'
import { RevealOnScroll, ImageReveal } from '../motion'
import { Button } from '../ui/Button'

export function QRAccess() {
  const demoUrl = typeof window !== 'undefined' ? `${window.location.origin}/items/item_wallet` : 'https://trace.app/items/item_wallet'
  return (
    <section className="py-24 lg:py-32" aria-labelledby="qr-heading">
      <div className="container-x grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        <RevealOnScroll>
          <ImageReveal
            src="/img/hero-flatlay.jpg"
            alt="Everyday belongings arranged on a clean surface"
            className="aspect-[4/3] w-full rounded-[4px] border border-line"
          />
        </RevealOnScroll>
        <div>
          <RevealOnScroll>
            <p className="eyebrow">QR Code Access</p>
            <h2 id="qr-heading" className="h2-section mt-4">
              One scan away from a report.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              QR codes can link to an item&apos;s public detail page, allowing someone who finds a
              registered item to access its reporting workflow — no account required to view.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={0.15}>
            <div className="mt-10 inline-flex flex-col items-start gap-5 rounded-[4px] border border-line bg-mist p-8">
              <div className="rounded-[3px] bg-paper p-4" aria-hidden>
                <QRCodeSVG value={demoUrl} size={148} level="M" />
              </div>
              <div>
                <p className="text-sm font-medium">Sample item QR</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                  This code is functional — it encodes a live URL to the sample wallet listing on
                  this deployment.
                </p>
              </div>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={0.25}>
            <Button asChildLink="/items/item_wallet" variant="secondary" className="mt-8" showArrow>
              See How QR Works
            </Button>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  )
}
