// 모든 프로젝트의 Storage 이미지 일괄 압축 스크립트 (일회성)
// - 여러 Supabase 프로젝트 × 모든 버킷 × 모든 폴더(재귀)를 순회
// - 각 이미지를 다운로드 → 리사이즈+JPEG 압축 → 같은 경로에 덮어쓰기 (URL 유지)
//
// ── 사용법 ────────────────────────────────────────────────
// 1) 패키지 설치 (일회성):   npm i sharp
// 2) 프로젝트 목록 작성:      scripts/projects.local.json  (아래 예시, 깃에 안 올라감)
//      [
//        { "name": "line-recorder", "url": "https://xxxx.supabase.co", "serviceKey": "eyJ..." },
//        { "name": "가공일지",       "url": "https://yyyy.supabase.co", "serviceKey": "eyJ..." }
//      ]
//    (또는 단일 프로젝트만 할 경우 환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY 로도 가능)
// 3) 실행:                    node scripts/compress-existing.mjs
//
// ⚠️ serviceKey 는 전체 권한 비밀키입니다. projects.local.json 은 절대 깃/외부에 공유하지 마세요.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAX_DIM = 1600
const QUALITY = 70
const SKIP_UNDER = 600 * 1024  // 이미 이 크기보다 작으면 다운로드 없이 건너뜀 (이미 압축됨)
const CONCURRENCY = 8          // 동시 처리 장수 (병렬)
const isImage = (name) => /\.(jpe?g|png|webp|heic|heif)$/i.test(name)

// 프로젝트 목록 로드: projects.local.json 우선, 없으면 환경변수
function loadProjects() {
  const cfgPath = join(__dirname, 'projects.local.json')
  if (existsSync(cfgPath)) {
    const arr = JSON.parse(readFileSync(cfgPath, 'utf-8'))
    return arr.filter(p => p.url && p.serviceKey)
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    return [{ name: 'env', url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_KEY }]
  }
  return []
}

// 버킷 내 폴더 재귀 순회하며 파일 경로 수집
async function listFilesRecursive(sb, bucket, prefix = '') {
  const out = []
  let offset = 0
  const limit = 100
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit, offset, sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) out.push({ path, size: item.metadata?.size ?? null })  // 파일 (id 있음)
      else out.push(...await listFilesRecursive(sb, bucket, path))         // 폴더 → 재귀
    }
    if (data.length < limit) break
    offset += limit
  }
  return out
}

async function compressBucket(sb, bucket, stats) {
  const files = await listFilesRecursive(sb, bucket)
  const images = files.filter(f => isImage(f.path))
  console.log(`  📦 [${bucket}] 파일 ${files.length} / 이미지 ${images.length}`)

  // 다운로드 없이 건너뛸 작은 파일 먼저 처리
  const todo = []
  for (const { path, size } of images) {
    if (size != null && size < SKIP_UNDER) {
      stats.skipped++; stats.before += size; stats.after += size
    } else {
      todo.push({ path, size })
    }
  }
  console.log(`     → 압축 대상 ${todo.length}장 (건너뜀 ${images.length - todo.length}장)`)

  async function processOne({ path }) {
    try {
      const { data: blob, error: dErr } = await sb.storage.from(bucket).download(path)
      if (dErr) throw dErr
      const inputBuf = Buffer.from(await blob.arrayBuffer())

      const outBuf = await sharp(inputBuf)
        .rotate()
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALITY })
        .toBuffer()

      if (outBuf.length >= inputBuf.length) {
        stats.skipped++; stats.before += inputBuf.length; stats.after += inputBuf.length
        return
      }
      const { error: uErr } = await sb.storage.from(bucket).upload(path, outBuf, {
        upsert: true, contentType: 'image/jpeg', cacheControl: '3600',
      })
      if (uErr) throw uErr
      stats.done++; stats.before += inputBuf.length; stats.after += outBuf.length
      if (stats.done % 20 === 0) console.log(`     … 압축 ${stats.done}장째`)
    } catch (e) {
      stats.failed++
      console.log(`    ❌ ${path}  실패: ${e.message ?? e}`)
    }
  }

  // 동시 CONCURRENCY 개씩 병렬 처리
  let idx = 0
  async function worker() {
    while (idx < todo.length) {
      const cur = todo[idx++]
      await processOne(cur)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
}

async function run() {
  const projects = loadProjects()
  if (projects.length === 0) {
    console.error('❌ scripts/projects.local.json 또는 환경변수(SUPABASE_URL/SUPABASE_SERVICE_KEY)가 필요합니다.')
    process.exit(1)
  }
  console.log(`🗂  대상 프로젝트 ${projects.length}개\n`)

  const grand = { done: 0, skipped: 0, failed: 0, before: 0, after: 0 }

  for (const proj of projects) {
    console.log(`▶ 프로젝트: ${proj.name} (${proj.url})`)
    const sb = createClient(proj.url, proj.serviceKey)
    const { data: buckets, error } = await sb.storage.listBuckets()
    if (error) { console.log(`  ❌ 버킷 목록 실패: ${error.message}`); continue }
    if (!buckets || buckets.length === 0) { console.log('  (버킷 없음)'); continue }

    const stats = { done: 0, skipped: 0, failed: 0, before: 0, after: 0 }
    for (const b of buckets) {
      await compressBucket(sb, b.name, stats)
    }
    console.log(`  └ 압축 ${stats.done} / 유지 ${stats.skipped} / 실패 ${stats.failed}  |  ${(stats.before/1024/1024).toFixed(1)}MB → ${(stats.after/1024/1024).toFixed(1)}MB\n`)
    for (const k of Object.keys(grand)) grand[k] += stats[k]
  }

  console.log('═════════════════════════════')
  console.log(`전체 압축 ${grand.done} / 유지 ${grand.skipped} / 실패 ${grand.failed}`)
  console.log(`전체 용량: ${(grand.before/1024/1024).toFixed(1)}MB → ${(grand.after/1024/1024).toFixed(1)}MB`)
  const saved = grand.before - grand.after
  if (grand.before > 0) console.log(`전체 절감: ${(saved/1024/1024).toFixed(1)}MB (${(saved/grand.before*100).toFixed(0)}%)`)
}

run().catch(e => { console.error(e); process.exit(1) })
