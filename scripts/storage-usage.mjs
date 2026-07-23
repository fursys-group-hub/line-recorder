// 실제 Storage 사용량 집계 (대시보드 지연과 무관하게 현재 실측)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projects = JSON.parse(readFileSync(join(__dirname, 'projects.local.json'), 'utf-8'))

async function listFilesRecursive(sb, bucket, prefix = '') {
  const out = []
  let offset = 0
  const limit = 100
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit, offset, sortBy:{column:'name',order:'asc'} })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) out.push(item.metadata?.size ?? 0)
      else out.push(...await listFilesRecursive(sb, bucket, path))
    }
    if (data.length < limit) break
    offset += limit
  }
  return out
}

for (const proj of projects) {
  const sb = createClient(proj.url, proj.serviceKey)
  const { data: buckets } = await sb.storage.listBuckets()
  let grand = 0, grandN = 0
  console.log(`\n▶ ${proj.name}`)
  for (const b of buckets ?? []) {
    const sizes = await listFilesRecursive(sb, b.name)
    const total = sizes.reduce((a, c) => a + c, 0)
    grand += total; grandN += sizes.length
    console.log(`  📦 ${b.name.padEnd(18)} ${sizes.length}개  ${(total/1024/1024).toFixed(1)}MB`)
  }
  console.log(`  ── 합계: ${grandN}개  ${(grand/1024/1024).toFixed(1)}MB (${(grand/1024/1024/1024).toFixed(2)}GB)`)
}
