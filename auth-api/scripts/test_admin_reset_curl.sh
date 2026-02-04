#!/usr/bin/env bash
# 忘记密码（人工支持）接口自测：POST /admin/reset-password、POST /admin/toggle-disabled
# 需在 127.0.0.1 访问（或 ADMIN_ALLOWED_IPS 包含本机 IP）。使用前可选设置：
#   export BASE_URL=http://127.0.0.1:8000
#   export ADMIN_USER=admin
#   export ADMIN_PASS=change-me-admin
#   export TEST_USER=user@example.com

set -e
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-change-me-admin}"
TEST_USER="${TEST_USER:-test-reset@example.com}"

echo "=== 1. Admin Login ==="
LOGIN=$(curl -s -X POST "$BASE_URL/admin/login" -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN"
  exit 1
fi
echo "Token obtained"

echo "=== 2. POST /admin/reset-password（指定新密码） ==="
curl -s -X POST "$BASE_URL/admin/reset-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"username\":\"$TEST_USER\",\"new_password\":\"newpass12345\"}" | python3 -m json.tool

echo "=== 3. POST /admin/reset-password（生成临时密码） ==="
curl -s -X POST "$BASE_URL/admin/reset-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"username\":\"$TEST_USER\",\"generate_temp\":true}" | python3 -m json.tool

echo "=== 4. POST /admin/toggle-disabled（禁用） ==="
curl -s -X POST "$BASE_URL/admin/toggle-disabled" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"username\":\"$TEST_USER\",\"disabled\":true}" | python3 -m json.tool

echo "=== 5. POST /admin/toggle-disabled（启用） ==="
curl -s -X POST "$BASE_URL/admin/toggle-disabled" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"username\":\"$TEST_USER\",\"disabled\":false}" | python3 -m json.tool

echo "=== 6. 用户不存在时 404 ==="
curl -s -X POST "$BASE_URL/admin/reset-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"nonexistent@example.com","new_password":"newpass12345"}' | python3 -m json.tool

echo "=== Done ==="
