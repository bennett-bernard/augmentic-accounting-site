from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTICLES = ROOT / "articles"
STATIC = ROOT / "static"
ORIGIN = "https://augmenticaccounting.com"

# main.py currently resolves templates, articles, and static files from the
# repository root. Make the build command work regardless of its caller's cwd.
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from fastapi.routing import APIRoute  # noqa: E402

from main import app  # noqa: E402


def output_file_for(route: str, dist: Path = DIST) -> Path:
    """Map a clean site route to the index file Cloudflare should serve."""
    if not route.startswith("/"):
        raise ValueError(f"Route must begin with '/': {route}")

    route_parts = [part for part in route.split("/") if part]
    return dist.joinpath(*route_parts, "index.html")


def collect_routes(articles: Path = ARTICLES) -> set[str]:
    """Return every static route represented by the current content tree."""
    # APIRoute excludes FastAPI's documentation endpoints and the /static
    # mount. Non-parameterized page routes are therefore discovered
    # automatically when a new page is added to main.py.
    routes = {
        route.path
        for route in app.routes
        if isinstance(route, APIRoute) and "{" not in route.path
    }

    for year_directory in articles.iterdir():
        if not year_directory.is_dir():
            continue

        routes.add(f"/articles/{year_directory.name}")

        for month_directory in year_directory.iterdir():
            if not month_directory.is_dir():
                continue

            routes.add(f"/articles/{year_directory.name}/{month_directory.name}")

    for article_file in articles.rglob("*.md"):
        article_path = article_file.relative_to(articles).with_suffix("").as_posix()
        routes.add(f"/articles/{article_path}")

    return routes


def build_static(dist: Path = DIST) -> set[str]:
    """Render all FastAPI pages and copy static assets into a deployable tree."""
    routes = collect_routes()

    if dist.exists():
        shutil.rmtree(dist)

    dist.mkdir(parents=True)

    with TestClient(app, base_url=ORIGIN) as client:
        for route in sorted(routes):
            response = client.get(route)
            response.raise_for_status()

            # FastAPI's url_for generates absolute URLs. Root-relative links
            # work on both workers.dev previews and the production domain.
            html = response.text.replace(ORIGIN, "")

            output_file = output_file_for(route, dist)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(html, encoding="utf-8")

    shutil.copytree(STATIC, dist / "static")
    return routes


def main() -> None:
    routes = build_static()
    print(f"Built {len(routes)} pages into {DIST}")


if __name__ == "__main__":
    main()
