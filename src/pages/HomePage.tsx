import { FinalCTA } from '../components/home/FinalCTA'
import { HeroSection } from '../components/home/HeroSection'
import { HowItWorks } from '../components/home/HowItWorks'
import { Marquee } from '../components/home/Marquee'
import { QRAccess } from '../components/home/QRAccess'
import { RecentlyFound } from '../components/home/RecentlyFound'
import { SmartMatching } from '../components/home/SmartMatching'
import { StatsStrip } from '../components/home/StatsStrip'
import { TrustVerification } from '../components/home/TrustVerification'

export function HomePage() {
  return (
    <main>
      <HeroSection />
      <Marquee />
      <StatsStrip />
      <RecentlyFound />
      <HowItWorks />
      <SmartMatching />
      <TrustVerification />
      <QRAccess />
      <FinalCTA />
    </main>
  )
}
