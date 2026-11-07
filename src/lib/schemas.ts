import { z } from 'zod'

export const reportSchema = z.object({
  type: z.enum(['lost', 'found']),
  title: z.string().min(3, 'Give the item a clear name (at least 3 characters).'),
  category: z.string().min(1, 'Choose a category.'),
  description: z.string().min(20, 'Describe the item in at least 20 characters.'),
  location: z.string().min(1, 'Choose an approximate location.'),
  date: z.string().min(1, 'Enter the date.').refine((value) => {
    const parsed = new Date(value)
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value && parsed.getTime() <= Date.now()
  }, 'Enter a valid date that is not in the future.'),
  privateDetails: z.string().optional(),
})

export type ReportInput = z.infer<typeof reportSchema>

export const claimSchema = z.object({
  itemId: z.string().min(1, 'Select the found item you are claiming.'),
  statement: z
    .string().trim()
    .min(20, 'Explain why this item may belong to you (at least 20 characters).'),
  contactEmail: z.email('Enter a valid email address.'),
  q1: z.string().trim().min(1, 'Answer required.'),
  q2: z.string().trim().min(1, 'Answer required.'),
  q3: z.string().trim().min(1, 'Answer required.'),
  relatedLostReportId: z.string().optional(),
})

export type ClaimInput = z.infer<typeof claimSchema>

export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  name: z.string().optional(),
})

export type SignInInput = z.infer<typeof signInSchema>
