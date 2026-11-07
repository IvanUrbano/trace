import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import {
  COMMUNITY_NAME, COMMUNITY_STORAGE_KEY, POST_CATEGORIES, communityStateSchema,
  createCommunityPost, removeCommunityPost, type CommunityState,
} from '../lib/community'
import { useStore } from '../lib/store'

function loadCommunity(): { state: CommunityState; error: string } {
  const empty: CommunityState = { version: 1, posts: [] }
  try {
    const raw = localStorage.getItem(COMMUNITY_STORAGE_KEY)
    if (raw === null) return { state: empty, error: '' }
    const parsed = communityStateSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return { state: parsed.data, error: '' }
  } catch { /* preserve unreadable data; never overwrite it with an empty board */ }
  return { state: empty, error: 'Saved community posts could not be read. Posting is disabled to preserve your saved data.' }
}

const fieldClass = 'mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink'

export function CommunityPage() {
  const { user, toast } = useStore()
  const [loaded] = useState(loadCommunity)
  const [state, setState] = useState(loaded.state)
  const current = useRef(state)
  const [filter, setFilter] = useState('All posts')
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [storageError, setStorageError] = useState('')

  const commit = (next: CommunityState) => {
    if (loaded.error) return false
    try {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(next))
      current.current = next
      setState(next)
      setStorageError('')
      return true
    } catch {
      setStorageError('Changes were not saved. Browser storage is full or unavailable. Free space and try again.')
      return false
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const result = createCommunityPost(current.current, user, {
      title: fields.get('title'), body: fields.get('body'), category: fields.get('category'),
    })
    if (!result.ok) { setFormError(result.error.message); return }
    setFormError('')
    if (commit(result.value)) {
      form.reset()
      setFilter('All posts')
      setSearch('')
      toast('Community post saved in this browser')
    }
  }

  const remove = () => {
    if (!removing) return
    const result = removeCommunityPost(current.current, user, removing)
    if (!result.ok) { toast(result.error.message, 'error'); return }
    if (commit(result.value)) {
      setRemoving(null)
      toast('Post removed from the board')
    }
  }

  const posts = state.posts.filter((post) => post.status === 'visible' &&
    (filter === 'All posts' || post.category === filter) &&
    `${post.title} ${post.body}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <header className="max-w-2xl">
        <p className="eyebrow">{COMMUNITY_NAME} · Community</p>
        <h1 className="h2-section mt-3">Community Board</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">Share helpful updates, lost-and-found tips, and community announcements.</p>
      </header>
      <aside className="mt-6 rounded-[3px] border border-line bg-mist/60 p-4 text-sm leading-relaxed text-muted">
        <strong className="text-ink">Local demo.</strong> Posts are saved only in this browser and are not shared across devices. Announcements are demo posts, not official city notices.
        <p className="mt-2">Keep contact details and ownership proof private. For an actual lost or found item, <Link to="/report" className="font-medium text-ink underline underline-offset-4">submit an item report</Link>. Claims and returns are handled on the item page.</p>
      </aside>
      {(loaded.error || storageError) && <p role="alert" className="mt-5 rounded-[3px] border border-ink p-4 text-sm">{loaded.error || storageError}</p>}
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Community posts" className="min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Search posts
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass} placeholder="Search updates and tips" />
            </label>
            <label className="text-sm font-medium">Post category
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className={fieldClass}>
                {['All posts', ...POST_CATEGORIES].map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-5 text-sm text-muted" role="status">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
          <div className="mt-4 space-y-5">
            {posts.map((post) => (
              <article key={post.id} className="rounded-[3px] border border-line bg-paper p-5 sm:p-6">
                <p className="text-xs font-medium text-accent">{post.category}</p>
                <h2 className="mt-2 break-words text-xl font-semibold tracking-tight">{post.title}</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.body}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
                  <p className="min-w-0 break-words">{post.authorName} · <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-PH')}</time></p>
                  {user && (user.id === post.authorId || user.role === 'admin') && (
                    <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => setRemoving(post.id)} aria-label={`Remove post: ${post.title}`}>Remove post</button>
                  )}
                </div>
              </article>
            ))}
            {!posts.length && <div className="rounded-[3px] border border-dashed border-line px-6 py-12 text-center">
              <h2 className="font-semibold">{state.posts.some((post) => post.status === 'visible') ? 'No matching posts.' : 'The board is ready for its first post.'}</h2>
              <p className="mt-2 text-sm text-muted">{search || filter !== 'All posts' ? 'Try another search or category.' : 'Share a useful update for the community.'}</p>
            </div>}
          </div>
        </section>
        <section className="min-w-0 rounded-[3px] border border-line bg-mist/40 p-5 sm:p-6" aria-labelledby="new-post-title">
          <h2 id="new-post-title" className="text-lg font-semibold">Write a post</h2>
          {user ? <form onSubmit={submit} className="mt-5 space-y-5">
            <p className="break-words text-xs text-muted">Posting as {user.name}. Your display name will appear on the board.</p>
            <label className="block text-sm font-medium" htmlFor="post-category">Category
              <select id="post-category" name="category" className={fieldClass} disabled={!!loaded.error}>
                {POST_CATEGORIES.filter((category) => category !== 'Announcement' || user.role === 'admin').map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium" htmlFor="post-title">Title
              <input id="post-title" name="title" required minLength={5} maxLength={120} className={fieldClass} disabled={!!loaded.error} />
            </label>
            <label className="block text-sm font-medium" htmlFor="post-body">Message
              <textarea id="post-body" name="body" required minLength={15} maxLength={3000} rows={6} className={fieldClass} disabled={!!loaded.error} />
            </label>
            {formError && <p role="alert" className="text-sm">{formError}</p>}
            <Button type="submit" className="w-full" disabled={!!loaded.error}>Publish post</Button>
          </form> : <div className="mt-4 text-sm leading-relaxed text-muted">
            <p>Browse freely. Sign in with a demo account to share an update.</p>
            <Button asChildLink="/signin" variant="secondary" className="mt-5">Sign in to post</Button>
          </div>}
        </section>
      </div>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove community post">
        <p className="text-sm leading-relaxed text-muted">This post will be removed from the board. Its local record remains in browser storage.</p>
        {storageError && <p role="alert" className="mt-4 text-sm">{storageError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
          <Button type="button" onClick={remove}>Remove post</Button>
        </div>
      </Modal>
    </main>
  )
}
