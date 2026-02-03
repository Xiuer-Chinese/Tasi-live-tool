#!/usr/bin/env bash
# 管理员接口自测：admin/login -> list users -> disable/enable -> reset-password -> delete（测试用户）
# 使用前设置 BASE_URL 与 ADMIN 账号密码，例如：
#   export BASE_URL=http://121.41.179.197:8000
#   export ADMIN_USER=admin
#   export ADMIN_PASS=your_admin_password

set -e
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-change-me-admin}"
TEST_USER="${TEST_USER:-test-admin-delete@example.com}"
TEST_PASS="${TEST_PASS:-TestPass123}"

echo "=== 1. Admin Login ==="
LOGIN=$(curl -s -X POST "$BASE_URL/admin/login" -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN"
  exit 1
fi
echo "Token obtained (length ${#TOKEN})"

echo "=== 2. List Users ==="
curl -s -X GET "$BASE_URL/admin/users?page=1&size=5" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== 3. Register test user (for disable/enable/reset/delete) ==="
curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" | python3 -m json.tool || true

echo "=== 4. Disable test user ==="
curl -s -X POST "$BASE_URL/admin/users/$(echo $TEST_USER | sed 's/+/%2B/g')/disable" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== 5. Enable test user ==="
curl -s -X POST "$BASE_URL/admin/users/$(echo $TEST_USER | sed 's/+/%2B/g')/enable" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== 6. Reset password (no body -> temp password) ==="
curl -s -X POST "$BASE_URL/admin/users/$(echo $TEST_USER | sed 's/+/%2B/g')/reset-password" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | python3 -m json.tool

echo "=== 7. Delete test user ==="
curl -s -X DELETE "$BASE_URL/admin/users/$(echo $TEST_USER | sed 's/+/%2B/g')" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== Done ==="
