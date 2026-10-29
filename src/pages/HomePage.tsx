import { FinalCTA } from '../components/home/FinalCTA'
import { HeroSection } from '../components/home/HeroSection'
import { HowItWorks } from '../components/home/HowItWorks'
import { QRAccess } from '../components/home/QRAccess'
import { RecentlyFound } from '../components/home/RecentlyFound'
import { SmartMatching } from '../components/home/SmartMatching'
import { TrustVerification } from '../components/home/TrustVerification'

export function HomePage() {
  return (
    <main>
      <HeroSection />
      <RecentlyFound />
      <HowItWorks />
      <SmartMatching />
      <TrustVerification />
      <QRAccess />
      <FinalCTA />
    </main>
  )
}
