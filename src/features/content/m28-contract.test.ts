import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration=readFileSync(new URL('../../../supabase/migrations/20260830000037_m28_editing_presets_notifications.sql',import.meta.url),'utf8')

describe('M28 workflow and notification contract',()=>{
 it('keeps media links optional while retaining DB-enforced submit RPCs',()=>{
  expect(migration).toContain('drop constraint if exists media_version_location_check')
  expect(migration).toContain('first_cut_submitted')
  expect(migration).toContain('revision_submitted')
  expect(migration).toContain('create trigger workflow_events_notify')
 })
 it('stores immutable preset snapshots with versions',()=>{
  expect(migration).toContain('preset_version integer not null')
  expect(migration).toContain('preset_snapshot jsonb not null')
  expect(migration).toContain('content_editing_presets_immutable')
 })
 it('targets notification recipients and supports preferences/read state',()=>{
  expect(migration).toMatch(/cr\.code in \('reviewer','owner'\)/)
  expect(migration).toMatch(/cr\.code in \('editor','owner'\)/)
  expect(migration).toMatch(/cr\.code in \('owner','publisher'\)/)
  expect(migration).toContain('mark_all_notifications_read')
  expect(migration).toContain('save_notification_preferences')
 })
 it('does not weaken Team Report event names',()=>{
  for(const event of ['first_cut_submitted','revision_submitted','final_media_submitted'])expect(migration).toContain(event)
 })
})
