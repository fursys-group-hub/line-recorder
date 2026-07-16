const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

export async function uploadFile(
  bucket: string,
  path: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': contentType,
        'Cache-Control': '3600',
      },
      body: new Uint8Array(body),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Storage upload failed: ${res.status} ${text}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}
