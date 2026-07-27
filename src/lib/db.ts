import { Pool } from 'pg'

// TLS 는 DATABASE_URL 의 sslmode 로 지정한다 (예: ?sslmode=require).
// 인증서 검증을 끄는 rejectUnauthorized:false 는 쓰지 않는다.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
})

export default pool
