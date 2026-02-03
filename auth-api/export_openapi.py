"""导出 OpenAPI 为 openapi.json，供 Appsmith/Budibase 等使用。在 auth-api 目录执行：python export_openapi.py"""
import json
import sys
import os

# 保证从 auth-api 目录加载
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from main import app

out_path = os.path.join(os.path.dirname(__file__), "openapi.json")
schema = app.openapi()
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(schema, f, ensure_ascii=False, indent=2)
print("Written:", out_path)
