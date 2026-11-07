import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { claimSchema, type ClaimInput } from '../lib/schemas'
import { useStore } from '../lib/store'
import type { Item } from '../lib/types'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

const questions = [
  'What identifying detail is not shown in the listing?',
  'Where and when did you last have the item?',
  'What else can help confirm that it is yours?',
]

export function ClaimForm({ item }: { item: Item }) {
  const [open, setOpen] = useState(false)
  const { submitClaim, user, toast, items } = useStore()
  const lostReports = items.filter((report) => report.type === 'lost' && report.status === 'active' && report.ownerId === user?.id)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    defaultValues: { itemId: item.id, contactEmail: user?.email ?? '' },
    mode: 'onTouched',
  })

  const onSubmit = async (data: ClaimInput) => {
    const submitted = submitClaim({
      itemId: item.id,
      statement: data.statement,
      contactEmail: data.contactEmail,
      relatedLostReportId: data.relatedLostReportId || undefined,
      questions: [
        { id: 'q1', question: questions[0], answer: data.q1 },
        { id: 'q2', question: questions[1], answer: data.q2 },
        { id: 'q3', question: questions[2], answer: data.q3 },
      ],
    })
    if (!submitted) return
    setOpen(false)
    toast('Track your claim in the dashboard')
    navigate('/dashboard?tab=claims')
  }

  const inputCls =
    'mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm transition-colors placeholder:text-muted/60 focus:border-ink'

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" className="w-full sm:w-auto">
        Submit a Claim
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Claim “${item.title}”`}>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          Answer the ownership questions below. Answers are not shown on listings. This demo saves
          them in your browser, so avoid sensitive information.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {lostReports.length > 0 && <div>
            <label htmlFor="relatedLostReportId" className="text-sm font-medium">Link your lost report <span className="font-normal text-muted">(optional)</span></label>
            <select id="relatedLostReportId" {...register('relatedLostReportId')} className={inputCls} defaultValue="">
              <option value="">No linked report</option>
              {lostReports.map((report) => <option key={report.id} value={report.id}>{report.title} · {report.location}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted">Your linked report will be closed if this item is returned to you.</p>
          </div>}
          <div>
            <label htmlFor="contactEmail" className="text-sm font-medium">
              Contact email
            </label>
            <input
              id="contactEmail"
              type="email"
              {...register('contactEmail')}
              className={inputCls}
              aria-invalid={!!errors.contactEmail}
            />
            {errors.contactEmail && (
              <p className="mt-1.5 text-xs font-medium" role="alert">{errors.contactEmail.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="statement" className="text-sm font-medium">
              Why does this item belong to you?
            </label>
            <textarea
              id="statement"
              rows={3}
              {...register('statement')}
              placeholder="Share context — where you had it, when you noticed it missing…"
              className={inputCls}
              aria-invalid={!!errors.statement}
            />
            {errors.statement && (
              <p className="mt-1.5 text-xs font-medium" role="alert">{errors.statement.message}</p>
            )}
          </div>
          {questions.map((q, i) => {
            const key = (['q1', 'q2', 'q3'] as const)[i]
            return (
              <div key={key}>
                <label htmlFor={key} className="text-sm font-medium">
                  {q}
                </label>
                <input
                  id={key}
                  {...register(key)}
                  className={inputCls}
                  aria-invalid={!!errors[key]}
                />
                {errors[key] && (
                  <p className="mt-1.5 text-xs font-medium" role="alert">{errors[key]?.message}</p>
                )}
              </div>
            )
          })}
          <p className="text-xs leading-relaxed text-muted">
            A person reviews the answers and decides the outcome. Nothing is approved automatically.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Claim
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
