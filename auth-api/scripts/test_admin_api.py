"""最小自测：admin/login -> list users -> 注册测试用户 -> disable -> enable -> reset-password -> delete。
在项目根或 auth-api 目录运行：python auth-api/scripts/test_admin_api.py
或：cd auth-api && python scripts/test_admin_api.py
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

# 可配置
BASE_URL = os.getenv("AUTH_BASE_URL", "http://127.0.0.1:8000")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "change-me-admin")
TEST_USER = "test-admin-delete@example.com"
TEST_PASS = "TestPass123"


def req(method: str, path: str, body=None, token: str = None):
    url = f"{BASE_URL.rstrip('/')}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.getcode(), json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode()) if e.read() else {}

def main():
    print("1. Admin login")
    code, data = req("POST", "/admin/login", {"username": ADMIN_USER, "password": ADMIN_PASS})
    if code != 200 or "token" not in data:
        print("FAIL login:", code, data)
        sys.exit(1)
    token = data["token"]
    print("   OK, token length:", len(token))

    print("2. List users")
    code, data = req("GET", "/admin/users?page=1&size=5", token=token)
    if code != 200:
        print("FAIL list:", code, data)
        sys.exit(1)
    print("   OK, count:", len(data) if isinstance(data, list) else data)

    print("3. Register test user")
    req("POST", "/register", {"username": TEST_USER, "password": TEST_PASS})

    print("4. Disable test user")
    code, data = req("POST", f"/admin/users/{urllib.parse.quote(TEST_USER)}/disable", token=token)
    if code != 200:
        print("FAIL disable:", code, data)
        sys.exit(1)
    print("   OK", data)

    print("5. Enable test user")
    code, data = req("POST", f"/admin/users/{urllib.parse.quote(TEST_USER)}/enable", token=token)
    if code != 200:
        print("FAIL enable:", code, data)
        sys.exit(1)
    print("   OK", data)

    print("6. Reset password (no new_password -> temp)")
    code, data = req("POST", f"/admin/users/{urllib.parse.quote(TEST_USER)}/reset-password", token=token)
    if code != 200:
        print("FAIL reset:", code, data)
        sys.exit(1)
    print("   OK, temp_password present:", "temp_password" in data)

    print("7. Delete test user")
    code, data = req("DELETE", f"/admin/users/{urllib.parse.quote(TEST_USER)}", token=token)
    if code != 200:
        print("FAIL delete:", code, data)
        sys.exit(1)
    print("   OK", data)

    print("Done. All steps passed.")


if __name__ == "__main__":
    main()
