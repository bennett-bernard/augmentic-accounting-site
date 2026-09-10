from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARTICLES = ROOT / "articles"
STATIC = ROOT / "static"

# main.py currently resolves templates, articles, and static files from the
# repository root. Make the build command work regardless of its caller's cwd.
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from fastapi.routing import APIRoute  # noqa: E402

from main import app  # noqa: E402
from site_content import ORIGIN, load_articles  # noqa: E402
from scenario_firms import SCENARIO_REDIRECTS  # noqa: E402


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
        and route.status_code not in {301, 302, 303, 307, 308}
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
    index = dist / "static" / "data" / "articles.json"
    index.parent.mkdir(parents=True, exist_ok=True)
    index.write_text(
        json.dumps(load_articles(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    # Workers Static Assets processes redirects before serving static pages.
    # Keep the old URLs out of the generated page tree and sitemap.
    (dist / "_redirects").write_text(
        "".join(f"{source} {target} 301\n" for source, target in sorted(SCENARIO_REDIRECTS.items())),
        encoding="utf-8",
    )
    write_crawler_files(routes, dist)
    return routes


def write_crawler_files(routes: set[str], dist: Path) -> None:
    """Keep crawler discovery in sync with the pages rendered by this build."""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for route in sorted(routes):
        url = ET.SubElement(urlset, "url")
        ET.SubElement(url, "loc").text = ORIGIN + quote(route, safe="/")

    ET.indent(urlset, space="  ")
    ET.ElementTree(urlset).write(
        dist / "sitemap.xml", encoding="utf-8", xml_declaration=True
    )
    (dist / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n",
        encoding="utf-8",
    )


def main() -> None:
    routes = build_static()
    print(f"Built {len(routes)} pages into {DIST}")


if __name__ == "__main__":
    main()
