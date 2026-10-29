export function PrivacyPage() {
  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <article className="prose-sm mx-auto max-w-2xl">
        <p className="eyebrow">Legal</p>
        <h1 className="h2-section mt-3">Privacy Policy</h1>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink/90">
          <p>
            TRACE is built around a simple principle: the details that prove ownership should never
            be public. This demo policy explains how information would be handled in production.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Public listings</h2>
          <p>
            Public item pages show only the title, category, approximate location, date, photos you
            choose to attach, and a general description. They never show private identifying
            details, ownership question answers, contact information, or claim statements.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Private data</h2>
          <p>
            Identifying details you provide on a lost report — such as unique marks or contents —
            are stored separately and are used only by authorized reviewers to evaluate claims.
            Claim answers are visible only to the claimant and administrators.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Account data</h2>
          <p>
            Your name and email are used for authentication, notifications about your reports and
            claims, and handoff coordination. This demo stores data in your browser&apos;s local
            storage only — nothing is sent to a server.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Camera access</h2>
          <p>
            The QR scanner requests camera access only when you explicitly start a scan. Frames are
            processed locally in your browser and never uploaded.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Audit records</h2>
          <p>
            Administrative actions — claim decisions and handoff confirmations — are recorded in an
            append-only audit log to keep the process accountable.
          </p>
        </div>
      </article>
    </main>
  )
}

export function TermsPage() {
  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <article className="prose-sm mx-auto max-w-2xl">
        <p className="eyebrow">Legal</p>
        <h1 className="h2-section mt-3">Terms of Service</h1>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink/90">
          <p>
            By using TRACE you agree to report items honestly, claim only items that may legitimately
            belong to you, and respect the verification process.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Accurate reports</h2>
          <p>
            Reports must describe items truthfully. Submitting false listings, decoy claims, or
            fraudulent ownership answers is grounds for suspension and may be reported to
            authorities where applicable.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Verification</h2>
          <p>
            Finding an item does not transfer ownership. Items change hands only after a human
            reviewer approves a claim and a handoff is recorded. TRACE never auto-approves
            ownership.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Liability</h2>
          <p>
            This is a demonstration application provided as-is. Sample listings are illustrative.
            In a production deployment, operators would define retention periods, jurisdiction, and
            dispute processes.
          </p>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Contact</h2>
          <p>Questions about these terms can be directed to the platform operators.</p>
        </div>
      </article>
    </main>
  )
}
