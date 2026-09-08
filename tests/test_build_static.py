import json
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest

from scripts.build_static import ORIGIN, build_static, collect_routes, output_file_for


def test_output_file_for_clean_routes(tmp_path: Path) -> None:
    assert output_file_for("/", tmp_path) == tmp_path / "index.html"
    assert output_file_for("/about", tmp_path) == tmp_path / "about" / "index.html"
    assert output_file_for("/articles/2026", tmp_path) == (
        tmp_path / "articles" / "2026" / "index.html"
    )


def test_output_file_for_rejects_non_route(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="begin with"):
        output_file_for("about", tmp_path)


def test_collect_routes_includes_pages_and_articles() -> None:
    routes = collect_routes()

    assert {"/", "/about", "/articles", "/coaching", "/resources", "/agent-demo"} <= routes
    assert "/articles/2026/02/claude-code-reconciliation-in-action" in routes
    assert "/articles/2026/05/core-four-ai-agents-for-accountants" in routes
    assert "/articles/2026/09/ai-videos-for-accountants" in routes


def test_build_static_renders_every_route_and_copies_assets(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    routes = build_static(dist)

    for route in routes:
        output_file = output_file_for(route, dist)
        assert output_file.is_file(), route
        assert ORIGIN not in output_file.read_text(encoding="utf-8")

    assert (dist / "static" / "css" / "styles.css").is_file()
    assert (dist / "static" / "js" / "site.js").is_file()
    assert (dist / "static" / "favicon.ico").is_file()
    catalog = json.loads((dist / "static/data/articles.json").read_text())
    article_routes = {route for route in routes if len(route.split("/")) == 5}
    assert {article["url"] for article in catalog} == {ORIGIN + route for route in article_routes}
    assert all(article["markdown"].startswith("# ") for article in catalog)
    demo = output_file_for("/agent-demo", dist).read_text()
    assert 'toolname="demo_find_articles"' in demo
    assert 'toolautosubmit' not in demo
    assert '/agent-demo' in output_file_for("/resources", dist).read_text()
    sitemap = ET.parse(dist / "sitemap.xml").getroot()
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    assert sitemap.tag == f"{namespace}urlset"
    locations = [node.text for node in sitemap.findall(f"{namespace}url/{namespace}loc")]
    assert len(locations) == len(routes) == len(set(locations))
    assert set(locations) == {ORIGIN + route for route in routes}
    assert not {"/docs", "/redoc", "/openapi.json", "/sitemap.xml", "/robots.txt"} & routes
    assert (dist / "robots.txt").read_text(encoding="utf-8") == (
        f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n"
    )
    assert (
        dist / "static" / "audio" / "AugmenticBlogRecording20251013_audio.m4a"
    ).is_file()

    companion_route = "/articles/2026/09/ai-videos-for-accountants"
    companion = output_file_for(companion_route, dist).read_text(encoding="utf-8")
    assert "<iframe" not in companion
    assert 'data-youtube-id="KiLT8RbUKCw"' in companion
    assert "https://www.youtube.com/watch?v=KiLT8RbUKCw" in companion
    assert "Full walkthrough coming soon." not in companion
    for eyebrow in ("Watch &amp; explore", "The finished videos", "Keep exploring"):
        assert eyebrow not in companion
    assert companion.count('<video ') == 2
    assert companion.count('preload="none"') == 2
    assert 'css/video-companion.css' in companion
    assert 'js/video-companion.js' in companion
    for filename in ("tax-return-summary.mp4", "puka-surfboards-pl.mp4"):
        relative = Path("static/video/ai-videos-for-accountants") / filename
        assert (dist / relative).read_bytes() == relative.read_bytes()
        assert f'download="{filename}"' in companion
    for route in ("/", "/articles", "/articles/2026", "/articles/2026/09"):
        assert companion_route in output_file_for(route, dist).read_text(encoding="utf-8")


def test_primary_audience_paths_are_prominent(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    build_static(dist)

    homepage = (dist / "index.html").read_text(encoding="utf-8")
    assert "https://augmentic-accounting.kit.com/407e73b0c9" in homepage
    assert "https://augmentic-accounting.kit.com/2473c7c8c4/index.js" in homepage
    assert "https://augmentic-accounting.kit.com/690ce48b27" not in homepage
    assert "https://www.youtube.com/@AugmenticAccounting" in homepage
    assert 'id="newsletter"' in homepage
    assert 'id="offers"' in homepage
    assert "Digital products" in homepage
    assert "Webinars" in homepage
    assert "1:1 coaching" in homepage

    products = (dist / "resources" / "index.html").read_text(encoding="utf-8")
    assert 'id="webinars"' in products
    assert "Coming soon" in products

    coaching = (dist / "coaching" / "index.html").read_text(encoding="utf-8")
    assert "Applied AI Coaching for Finance Leaders" in coaching


def test_sitemap_tracks_published_and_removed_content(tmp_path: Path, monkeypatch) -> None:
    # Use a separate content tree so publishing/removing never alters real posts.
    articles = tmp_path / "articles"
    month = articles / "2026" / "09"
    month.mkdir(parents=True)
    monkeypatch.setattr(
        "scripts.build_static.collect_routes", lambda: collect_routes(articles)
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        "main.templates.env.loader.searchpath",
        [str(Path(__file__).resolve().parents[1] / "templates")],
    )
    dist = tmp_path / "dist"
    article = month / "café & accounting.md"
    article.write_text(
        "---\ntitle: Test article\ndate: 2026-09-08\n---\nTest content.\n",
        encoding="utf-8",
    )
    location = f"{ORIGIN}/articles/2026/09/caf%C3%A9%20%26%20accounting"
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}

    build_static(dist)
    locations = ET.parse(dist / "sitemap.xml").findall("s:url/s:loc", namespace)
    assert location in {node.text for node in locations}
    output = output_file_for("/articles/2026/09/café & accounting", dist)
    assert output.is_file()
    catalog = json.loads((dist / "static/data/articles.json").read_text())
    assert [entry["url"] for entry in catalog] == [location]
    assert catalog[0]["resourceUri"] == "augmentic://articles/2026/09/caf%C3%A9%20%26%20accounting"
    assert 'Test article' in output_file_for("/agent-demo", dist).read_text()

    article.unlink()
    month.rmdir()
    build_static(dist)
    locations = ET.parse(dist / "sitemap.xml").findall("s:url/s:loc", namespace)
    assert location not in {node.text for node in locations}
    assert f"{ORIGIN}/articles/2026/09" not in {node.text for node in locations}
    assert not output.exists()
    assert json.loads((dist / "static/data/articles.json").read_text()) == []
    assert 'Test article' not in output_file_for("/agent-demo", dist).read_text()
