import { useEffect, useMemo, useState } from 'react'
import { publicItemSchema, type PublicItem } from '../contract/dto'
import { listPublicItemsResponse } from '../contract/responses'
import type { Item } from '../types'

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export function apiConfigured(): boolean {
  return configuredBaseUrl.length > 0
}

export interface PublicFilters {
  q: string
  type: 'lost' | 'found' | 'all'
  category: string
  location: string
  from: string
}

function toItem(dto: PublicItem): Item {
  return {
    id: dto.id,
    type: dto.type,
    title: dto.title,
    category: dto.category,
    description: dto.description,
    location: dto.location,
    date: dto.date,
    status: dto.status,
    images: dto.images,
    ownerId: '',
    ownerName: '',
    createdAt: dto.createdAt,
    timeline: dto.timeline,
  }
}

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${configuredBaseUrl}${path}`, {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json()
}

interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
}

export function usePublicItems(filters: PublicFilters): ItemsState & { enabled: boolean } {
  const enabled = apiConfigured()
  const [state, setState] = useState<ItemsState>({ items: [], loading: enabled, error: null })

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.type !== 'all') params.set('type', filters.type)
    if (filters.category) params.set('category', filters.category)
    if (filters.location) params.set('location', filters.location)
    if (filters.from) params.set('from', filters.from)
    if (filters.q.trim()) params.set('q', filters.q.trim())
    params.set('limit', '50')
    return params.toString()
  }, [filters.type, filters.category, filters.location, filters.from, filters.q])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setState((previous) => ({ ...previous, loading: true, error: null }))
      getJson(`/api/items?${query}`, controller.signal)
        .then((body) => {
          const parsed = listPublicItemsResponse.parse(body)
          setState({ items: parsed.items.map(toItem), loading: false, error: null })
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setState({ items: [], loading: false, error: 'Live listings could not be loaded.' })
        })
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [enabled, query])

  return { ...state, enabled }
}

interface ItemState {
  item: Item | null
  loading: boolean
  error: 'not_found' | 'unavailable' | null
}

export function usePublicItem(id: string | undefined): ItemState & { enabled: boolean } {
  const enabled = apiConfigured()
  const [state, setState] = useState<ItemState>({ item: null, loading: enabled, error: null })

  useEffect(() => {
    if (!enabled || !id) return
    const controller = new AbortController()
    setState({ item: null, loading: true, error: null })
    getJson(`/api/items/${encodeURIComponent(id)}`, controller.signal)
      .then((body) => {
        setState({ item: toItem(publicItemSchema.parse(body)), loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const status = error instanceof Error ? error.message.match(/(\d{3})$/)?.[1] : undefined
        setState({ item: null, loading: false, error: status === '404' ? 'not_found' : 'unavailable' })
      })
    return () => controller.abort()
  }, [enabled, id])

  return { ...state, enabled }
}
