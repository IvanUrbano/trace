import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rankFoundMatches } from '../src/lib/matching.ts'

const listing = (id, type, title, description, overrides = {}) => ({
  id, type, title, description, category: 'Wallets & Cards',
  location: 'Library', date: '2026-11-01T00:00:00.000Z',
  status: type === 'lost' ? 'active' : 'unclaimed', ...overrides,
})

test('ranks a close description above a category-only match', () => {
  const lost = listing('lost', 'lost', 'Brown leather wallet', 'Brown leather wallet with a worn edge')
  const close = listing('close', 'found', 'Brown leather wallet', 'Brown leather wallet found at library')
  const distant = listing('distant', 'found', 'Plastic card holder', 'Blue plastic card holder found at library')
  const results = rankFoundMatches(lost, [distant, close])
  assert.equal(results[0].item.id, 'close')
  assert.ok(results[0].score > results[1].score)
})

test('excludes other categories and returned items', () => {
  const lost = listing('lost', 'lost', 'Wallet', 'Leather wallet')
  const returned = listing('returned', 'found', 'Wallet', 'Leather wallet', { status: 'returned' })
  const keys = listing('keys', 'found', 'Wallet', 'Leather wallet', { category: 'Keys' })
  assert.deepEqual(rankFoundMatches(lost, [returned, keys]), [])
})

test('private ownership details never affect ranking', () => {
  const lost = listing('lost', 'lost', 'Wallet', 'Leather wallet', { privateDetails: 'secret A' })
  const found = listing('found', 'found', 'Wallet', 'Leather wallet', { privateDetails: 'secret B' })
  const first = rankFoundMatches(lost, [found])[0].score
  lost.privateDetails = 'completely different secret'
  found.privateDetails = 'another secret'
  assert.equal(rankFoundMatches(lost, [found])[0].score, first)
})

test('omits a category-only candidate with no useful supporting signal', () => {
  const lost = listing('lost', 'lost', 'Canvas tote', 'Canvas tote bag', { date: '2026-11-01T00:00:00.000Z' })
  const unrelated = listing('unrelated', 'found', 'Leather backpack', 'Leather backpack with laptop sleeve', {
    location: 'Another city', date: '2025-01-01T00:00:00.000Z',
  })
  assert.deepEqual(rankFoundMatches(lost, [unrelated]), [])
})
