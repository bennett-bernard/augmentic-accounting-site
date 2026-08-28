from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTICLES = ROOT / "articles"
ORIGIN = "https://augmenticaccounting.com"

os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from main import app

def output_file_for(route: str) -> Path:
	if route == "/":
		return DIST / "index.html"

	return DIST / route.lstrip("/") / "index.html"

routes = {
	"/",
	"/about",
	"/articles",
}

for year_directory in ARTICLES.iterdir():
	if not year_directory.is_dir():
		continue

	routes.add(f"/articles/{year_directory.name}")

	for month_directory in year_directory.iterdir():
		if not month_directory.is_dir():
			continue

		routes.add(
			f"/articles/{year_directory.name}/{month_directory.name}"
		)

for article_file in ARTICLES.rglob("*.md"):
	article_path = (
		article_file.relative_to(ARTICLES).with_suffix("").as_posix()
	)
	routes.add(f"/articles/{article_path}")

if DIST.exists():
	shutil.rmtree(DIST)

DIST.mkdir(parents=True)

with TestClient(app, base_url=ORIGIN) as client:
	for route in sorted(routes):
		response = client.get(route)
		response.raise_for_status()

		# FastAPI's url_for generates absolute URLs. Convert internal URLs back to root-relative links so workers.dev previews also work.
		html = response.text.replace(ORIGIN, "")

		output_file = output_file_for(route)
		output_file.parent.mkdir(parents=True, exist_ok=True)
		output_file.write_text(html, encoding="utf-8")

shutil.copytree(ROOT / "static", DIST / "static")

print(f"Built {len(routes)} pages into {DIST}")
