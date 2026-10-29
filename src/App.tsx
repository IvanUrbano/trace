import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { NotificationToast } from './components/NotificationToast'
import { AdminPage } from './pages/AdminPage'
import { ClaimPage } from './pages/ClaimPage'
import { DashboardPage } from './pages/DashboardPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { HomePage } from './pages/HomePage'
import { ItemDetailsPage } from './pages/ItemDetailsPage'
import { TermsPage, PrivacyPage } from './pages/LegalPages'
import { ReportPage } from './pages/ReportPage'
import { SignInPage } from './pages/SignInPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/discover" element={<PageTransition><DiscoverPage /></PageTransition>} />
            <Route path="/items/:id" element={<PageTransition><ItemDetailsPage /></PageTransition>} />
            <Route path="/report" element={<PageTransition><ReportPage /></PageTransition>} />
            <Route path="/claim/:itemId" element={<PageTransition><ClaimPage /></PageTransition>} />
            <Route path="/dashboard" element={<PageTransition><DashboardPage /></PageTransition>} />
            <Route path="/admin" element={<PageTransition><AdminPage /></PageTransition>} />
            <Route path="/signin" element={<PageTransition><SignInPage /></PageTransition>} />
            <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
            <Route
              path="*"
              element={
                <PageTransition>
                  <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
                    <p className="eyebrow">404</p>
                    <h1 className="h2-section mt-3">Page not found.</h1>
                    <a href="/" className="mt-6 text-sm font-medium underline underline-offset-4">
                      Return home
                    </a>
                  </main>
                </PageTransition>
              }
            />
          </Routes>
        </AnimatePresence>
      </div>
      <Footer />
      <NotificationToast />
    </div>
  )
}
