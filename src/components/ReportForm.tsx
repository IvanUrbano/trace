import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES, LOCATIONS } from '../lib/types'
import { reportSchema, type ReportInput } from '../lib/schemas'
import { useStore } from '../lib/store'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

const steps = ['Basics', 'Details', 'Review'] as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-medium text-ink" role="alert">{message}</p>
}

export function ReportForm() {
  const [params] = useSearchParams()
  const initialType = params.get('type') === 'found' ? 'found' : 'lost'
  const [step, setStep] = useState(0)
  const [previews, setPreviews] = useState<string[]>([])
  const { addItem } = useStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { type: initialType, date: new Date().toISOString().slice(0, 10) },
    mode: 'onTouched',
  })

  const type = watch('type')

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const selected = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 4)
    void Promise.all(
      selected.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('Failed to read image'))
            reader.readAsDataURL(f)
          }),
      ),
    ).then((urls) => {
      setPreviews((p) => [...p, ...urls].slice(0, 4))
    })
  }

  const removePreview = (idx: number) => setPreviews((p) => p.filter((_, i) => i !== idx))

  const validateStep = async () => {
    if (step === 0) return trigger(['type', 'title', 'category'])
    if (step === 1) return trigger(['description', 'location', 'date'])
    return true
  }

  const next = async () => {
    const ok = await validateStep()
    if (ok) setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const onSubmit = async (data: ReportInput) => {
    const images = previews.length ? previews : ['/img/hero-flatlay.jpg']
    const id = addItem({
      type: data.type,
      title: data.title,
      category: data.category,
      description: data.description,
      location: data.location,
      date: new Date(data.date).toISOString(),
      status: data.type === 'lost' ? 'active' : 'unclaimed',
      images,
      privateDetails: data.privateDetails || undefined,
    })
    navigate(`/items/${id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <ol className="mb-10 flex items-center gap-2" aria-label="Report progress">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                i <= step ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-muted',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              {i + 1}
            </span>
            <span className={cn('hidden text-sm font-medium sm:block', i <= step ? 'text-ink' : 'text-muted')}>
              {s}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      <fieldset className="mb-8">
        <legend className="text-sm font-semibold">I am reporting…</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(['lost', 'found'] as const).map((t) => (
            <label
              key={t}
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-[3px] border px-4 py-4 text-sm font-medium transition-all',
                type === t ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink',
              )}
            >
              <input
                type="radio"
                value={t}
                className="sr-only"
                {...register('type')}
              />
              {t === 'lost' ? 'I Lost Something' : 'I Found Something'}
            </label>
          ))}
        </div>
        <FieldError message={errors.type?.message} />
      </fieldset>

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="text-sm font-medium">
              Item name
            </label>
            <input
              id="title"
              {...register('title')}
              placeholder="e.g. Black leather wallet"
              className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm transition-colors placeholder:text-muted/60 focus:border-ink"
              aria-invalid={!!errors.title}
            />
            <FieldError message={errors.title?.message} />
          </div>
          <div>
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              {...register('category')}
              className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
              aria-invalid={!!errors.category}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError message={errors.category?.message} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              {...register('description')}
              placeholder="Describe the item, distinguishing features, and circumstances…"
              className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm transition-colors placeholder:text-muted/60 focus:border-ink"
              aria-invalid={!!errors.description}
            />
            <FieldError message={errors.description?.message} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="location" className="text-sm font-medium">
                Approximate location
              </label>
              <select
                id="location"
                {...register('location')}
                className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
                aria-invalid={!!errors.location}
              >
                <option value="">Select a location</option>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <FieldError message={errors.location?.message} />
            </div>
            <div>
              <label htmlFor="date" className="text-sm font-medium">
                {type === 'lost' ? 'Date lost' : 'Date found'}
              </label>
              <input
                id="date"
                type="date"
                {...register('date')}
                className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
                aria-invalid={!!errors.date}
              />
              <FieldError message={errors.date?.message} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Photos <span className="font-normal text-muted">(optional, up to 4)</span></p>
            <label
              className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-[3px] border border-dashed border-line bg-mist/50 px-6 py-10 text-center transition-colors hover:border-ink"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFiles(e.dataTransfer.files)
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <ImagePlus className="h-5 w-5 text-muted" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium">Drag photos here or click to browse</p>
              <p className="mt-1 text-xs text-muted">JPG or PNG</p>
            </label>
            {previews.length > 0 && (
              <ul className="mt-4 grid grid-cols-4 gap-3">
                {previews.map((src, i) => (
                  <li key={i} className="relative">
                    <img src={src} alt={`Preview ${i + 1}`} className="aspect-square w-full rounded-[3px] border border-line object-cover" />
                    <button
                      type="button"
                      onClick={() => removePreview(i)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-2 -top-2 rounded-full border border-line bg-paper p-1 shadow-sm transition-colors hover:bg-ink hover:text-paper"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {type === 'lost' && (
            <div>
              <label htmlFor="privateDetails" className="text-sm font-medium">
                Identifying details <span className="font-normal text-muted">(stored privately)</span>
              </label>
              <textarea
                id="privateDetails"
                rows={2}
                {...register('privateDetails')}
                placeholder="Details only the true owner would know — never shown in public listings."
                className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm transition-colors placeholder:text-muted/60 focus:border-ink"
              />
              <p className="mt-1.5 text-xs text-muted">
                Used to craft ownership questions. Never displayed publicly.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-[3px] border border-line bg-mist/60 p-6">
          <h3 className="font-semibold">Review your report</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Type</dt>
              <dd className="font-medium capitalize">{type}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Item</dt>
              <dd className="font-medium">{watch('title')}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Category</dt>
              <dd className="font-medium">{watch('category')}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Location</dt>
              <dd className="font-medium">{watch('location')}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Date</dt>
              <dd className="font-medium">{watch('date')}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Photos</dt>
              <dd className="font-medium">{previews.length || 'Default image'}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            By submitting you confirm this report is accurate. Private identifying details are
            stored securely and never shown in public listings.
          </p>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={next} showArrow>
            Continue
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        )}
      </div>
    </form>
  )
}
