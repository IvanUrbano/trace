import { z } from 'zod'
import { fail, ok } from './contract/errors.ts'
import type { User } from './types'
import { uid } from './utils.ts'

export const COMMUNITY_STORAGE_KEY = 'trace_community_v1'
export const COMMUNITY_NAME = 'Mandaluyong'
export const POST_CATEGORIES = ['Community update', 'Lost-and-found tip', 'Announcement'] as const

export const communityPostInput = z.object({
  title: z.string().trim().min(5, 'Use at least 5 characters for the title.').max(120),
  body: z.string().trim().min(15, 'Add at least 15 characters to your post.').max(3000),
  category: z.enum(POST_CATEGORIES),
})

const postSchema = communityPostInput.extend({
  id: z.string().min(1),
  communityId: z.literal('mandaluyong'),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  createdAt: z.iso.datetime(),
  status: z.enum(['visible', 'removed']),
})

export type CommunityPost = z.infer<typeof postSchema>
export const communityStateSchema = z.object({ version: z.literal(1), posts: z.array(postSchema) })
export type CommunityState = z.infer<typeof communityStateSchema>

/** Demo operations take author identity from the current actor, never from form input. */
export function createCommunityPost(state: CommunityState, actor: User | null, input: unknown) {
  if (!actor) return fail<CommunityState>('unauthorized', 'Sign in to post to the community.')
  const parsed = communityPostInput.safeParse(input)
  if (!parsed.success) return fail<CommunityState>('validation', parsed.error.issues[0].message)
  if (parsed.data.category === 'Announcement' && actor.role !== 'admin') {
    return fail<CommunityState>('forbidden', 'Only demo administrators can publish announcements.')
  }
  const post: CommunityPost = {
    ...parsed.data,
    id: uid('post'),
    communityId: 'mandaluyong',
    authorId: actor.id,
    authorName: actor.name,
    createdAt: new Date().toISOString(),
    status: 'visible',
  }
  return ok<CommunityState>({ ...state, posts: [post, ...state.posts] })
}

export function removeCommunityPost(state: CommunityState, actor: User | null, postId: string) {
  if (!actor) return fail<CommunityState>('unauthorized', 'Sign in to manage a post.')
  const post = state.posts.find((entry) => entry.id === postId && entry.status === 'visible')
  if (!post) return fail<CommunityState>('not_found', 'This post is no longer available.')
  if (actor.role !== 'admin' && post.authorId !== actor.id) {
    return fail<CommunityState>('forbidden', 'You can only remove your own posts.')
  }
  return ok<CommunityState>({
    ...state,
    posts: state.posts.map((entry) => entry.id === postId ? { ...entry, status: 'removed' } : entry),
  })
}
