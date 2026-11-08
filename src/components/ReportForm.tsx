import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES, LOCATIONS } from '../lib/types'
import { reportSchema, type ReportInput } from '../lib/schemas'
import { useStore } from '../lib/store'
import { apiConfigured, requestPhotoUpload, submitReport, uploadPhotoToS3 } from '../lib/api/client'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

const steps = ['Basics', 'Details', 'Review'] as const
const MAX_SOURCE_BYTES = 5_000_000
const MAX_STORED_LENGTH = 700_000

async function preparePhoto(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement
  let release: () => void
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    source = bitmap
    release = () => bitmap.close()
  } else {
    const url = URL.createObjectURL(file)
    const image = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Photo could not be decoded'))
        image.src = url
      })
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
    source = image
    release = () => URL.revokeObjectURL(url)
  }
  try {
    const scale = Math.min(1, 1024 / Math.max(source.width, source.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable in this browser')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/jpeg', 0.72)
    if (!result.startsWith('data:image/jpeg;') || result.length > MAX_STORED_LENGTH) throw new Error('Photo is too large after compression')
    return result
  } finally {
    release()
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-medium text-ink" role="alert">{message}</p>
}

interface ReportFormProps {
  mode?: 'demo' | 'cloud'
}

export function ReportForm({ mode = 'demo' }: ReportFormProps) {
  const [params] = useSearchParams()
  const initialType = params.get('type') === 'found' ? 'found' : 'lost'
  const [step, setStep] = useState(0)
  const [previews, setPreviews] = useState<string[]>([])
  const [photoKeys, setPhotoKeys] = useState<string[]>([])
  const [photoError, setPhotoError] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const processingRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const cloud = mode === 'cloud'
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

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || processingRef.current || isSubmitting) return
    setPhotoError('')
    const selected = Array.from(files)
    if (selected.length > 4 - previews.length) {
      setPhotoError('You can add up to four photos.')
      return
    }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_SOURCE_BYTES)) {
      setPhotoError('Use JPG, PNG, or WebP photos under 5 MB each.')
      return
    }
    processingRef.current = true
    setProcessingPhotos(true)
    try {
      const results = await Promise.all(selected.map(async (file) => {
        const preview = await preparePhoto(file)
        let objectKey: string | undefined
        if (cloud) {
          const presigned = await requestPhotoUpload(file)
          await uploadPhotoToS3(file, presigned.uploadUrl)
          objectKey = presigned.objectKey
        }
        return { preview, objectKey }
      }))
      if (mounted.current) {
        setPreviews((current) => [...current, ...results.map((r) => r.preview)])
        setPhotoKeys((current) => [...current, ...results.map((r) => r.objectKey).filter((k): k is string => Boolean(k))])
      }
    } catch {
      if (mounted.current) setPhotoError('Could not upload a photo. Try a smaller image.')
    } finally {
      processingRef.current = false
      if (mounted.current) setProcessingPhotos(false)
    }
  }

  const removePreview = (idx: number) => {
    setPreviews((p) => p.filter((_, i) => i !== idx))
    setPhotoKeys((k) => k.filter((_, i) => i !== idx))
  }

  const validateStep = async () => {
    if (step === 0) return trigger(['type', 'title', 'category'])
    if (step === 1) return trigger(['description', 'location', 'date'])
    return true
  }

  const next = async () => {
    if (processingRef.current) return
    const ok = await validateStep()
    if (ok) setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const onSubmit = async (data: ReportInput) => {
    if (step !== 2 || processingRef.current) return
    setSubmitError(null)
    if (cloud) {
      if (!apiConfigured()) {
        setSubmitError('Live reports are not configured yet.')
        return
      }
      try {
        const id = await submitReport({
          type: data.type,
          title: data.title.trim(),
          category: data.category.trim(),
          description: data.description.trim(),
          location: data.location.trim(),
          date: data.date,
          privateDetails: data.privateDetails?.trim() || undefined,
          images: photoKeys,
        })
        navigate(`/items/${id}`)
      } catch (error) {
        if (error instanceof Error) {
          setSubmitError(
            error.message || 'Could not submit the report. Please try again.',
          )
        } else {
          setSubmitError('Could not submit the report. Please try again.')
        }
      }
      return
    }
    const images = previews
    const id = addItem({
      type: data.type,
      title: data.title,
      category: data.category,
      description: data.description,
      location: data.location,
      date: data.date,
      images,
      privateDetails: data.privateDetails || undefined,
    })
    if (id) navigate(`/items/${id}`)
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
                disabled={processingPhotos || isSubmitting}
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <ImagePlus className="h-5 w-5 text-muted" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium">Drag photos here or click to browse</p>
              <p className="mt-1 text-xs text-muted">JPG, PNG, or WebP · up to 5 MB each</p>
            </label>
            {processingPhotos && <p className="mt-2 text-sm text-muted" role="status">Processing photos… Please wait before continuing.</p>}
            {photoError && <p className="mt-2 text-xs font-medium" role="alert">{photoError}</p>}
            {cloud && previews.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Photos are processed for preview but aren&apos;t saved with cloud reports yet (coming next phase).
              </p>
            )}
            {previews.length > 0 && (
              <ul className="mt-4 grid grid-cols-4 gap-3">
                {previews.map((src, i) => (
                  <li key={i} className="relative">
                    <img src={src} alt={`Preview ${i + 1}`} className="aspect-square w-full rounded-[3px] border border-line object-cover" />
                    <button
                      type="button"
                      disabled={processingPhotos || isSubmitting}
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

          <div>
              <label htmlFor="privateDetails" className="text-sm font-medium">
                {type === 'lost' ? 'Identifying details' : 'Private reference details'} <span className="font-normal text-muted">(optional demo data)</span>
              </label>
              <textarea
                id="privateDetails"
                rows={2}
                {...register('privateDetails')}
                placeholder={type === 'lost' ? 'Details only the true owner would know.' : 'Describe a detail you withheld from the public listing for a reviewer to compare.'}
                className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm transition-colors placeholder:text-muted/60 focus:border-ink"
              />
              <p className="mt-1.5 text-xs text-muted">
                Not shown on listings. This demo saves details in your browser; avoid sensitive information.
              </p>
          </div>
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
              <dd className="font-medium">{previews.length || 'No photos'}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            By submitting you confirm this report is accurate.{' '}
            {cloud
              ? 'This report is saved to your TRACE account. Photos are not yet saved with cloud reports (coming next phase).'
              : 'This demo saves report data in your browser. Avoid sensitive information until secure cloud storage is connected.'}
          </p>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || processingPhotos || isSubmitting}
        >
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" disabled={processingPhotos || isSubmitting} onClick={(event) => { event.preventDefault(); void next() }} showArrow>
            Continue
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting || processingPhotos}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        )}
      </div>
      {submitError && <p className="mt-4 text-xs font-medium text-ink" role="alert">{submitError}</p>}
    </form>
  )
}
