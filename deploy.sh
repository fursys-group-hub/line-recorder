#!/bin/bash
# ============================================================
# line-recorder 배포 스크립트
# 로컬 PC에서 실행하세요
# ============================================================

set -e

REPO_NAME="line-recorder"
GITHUB_USER=""   # ← 본인 GitHub 아이디 입력

echo "=== 1. git bundle에서 복원 ==="
git clone line-recorder.bundle $REPO_NAME
cd $REPO_NAME
git remote remove origin 2>/dev/null || true

echo "=== 2. GitHub 저장소 생성 및 push ==="
echo "GitHub에서 '$REPO_NAME' 저장소를 먼저 생성하세요 (Private 권장)"
echo "생성 후 Enter..."
read

git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
git branch -M main
git push -u origin main
echo "GitHub push 완료"

echo ""
echo "=== 3. Vercel 배포 ==="
echo "다음 중 선택:"
echo "  A) Vercel CLI: npm i -g vercel && vercel"
echo "  B) Vercel 웹사이트: vercel.com → New Project → Import Git Repository"
echo ""
echo "=== 4. Vercel 환경변수 설정 (반드시 설정) ==="
echo "Settings → Environment Variables:"
echo "  DATABASE_URL                  = postgresql://postgres:...@db.xxx.supabase.co:5432/postgres"
echo "  SUPABASE_URL                  = https://xxx.supabase.co  (사진 업로드용)"
echo "  SUPABASE_SERVICE_KEY          = eyJhbG... (서버 전용 서비스 키)"
echo "  APP_PASSWORD                  = 앱 비밀번호"
echo "  ADMIN_PASSWORD                = 관리자 비밀번호"
echo "  N8N_WEBHOOK_URL               = http://n8n서버:5678/webhook/line-recorder"
echo ""
echo "=== 5. Supabase SQL 실행 ==="
echo "Supabase → SQL Editor → supabase_schema_v3.sql 실행"
echo ""
echo "배포 완료 후 URL: https://$REPO_NAME.vercel.app"
