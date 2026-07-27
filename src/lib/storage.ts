import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 사내 Supabase Storage 접속 — 브라우저에 노출되지 않는 서버 전용 모듈.
// service_role 키를 쓰지 않고, 발급받은 이메일/비밀번호로 로그인한 세션으로 접근한다.
// 버킷은 비공개이므로 조회는 항상 임시 주소(signed URL)로 발급한다.
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const EMAIL = process.env.SUPABASE_EMAIL ?? ''
const PASSWORD = process.env.SUPABASE_PASSWORD ?? ''
const BUCKET = process.env.SUPABASE_BUCKET ?? ''

let client: SupabaseClient | null = null

// 세션이 없거나 곧 만료되면 이메일/비밀번호로 다시 로그인한다.
async function getClient(): Promise<SupabaseClient> {
  if (!client) {
    client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  const { data } = await client.auth.getSession()
  const now = Math.floor(Date.now() / 1000)
  if (!data.session || (data.session.expires_at ?? 0) - now < 120) {
    const { error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
    if (error) throw new Error(`스토리지 로그인 실패: ${error.message}`)
  }
  return client
}

// 파일 업로드 → 저장 "경로"(문자열)를 반환한다. DB에는 이 경로만 저장한다.
export async function uploadFile(path: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const c = await getClient()
  const { error } = await c.storage.from(BUCKET).upload(path, new Uint8Array(body), {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (error) throw new Error(`업로드 실패: ${error.message}`)
  return path
}

// 저장 경로 → 임시 조회 주소(signed URL). 기본 1시간.
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const c = await getClient()
  const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}

// 여러 경로를 한 번에 서명 → { 경로: 임시주소 } 매핑 반환.
export async function signPaths(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  if (!paths.length) return map
  const c = await getClient()
  const { data, error } = await c.storage.from(BUCKET).createSignedUrls(paths, expiresIn)
  if (error) return map
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }
  return map
}
