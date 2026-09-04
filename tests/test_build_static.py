from pathlib import Path

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

    assert {"/", "/about", "/articles", "/coaching", "/resources"} <= routes
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
    assert (
        dist / "static" / "audio" / "AugmenticBlogRecording20251013_audio.m4a"
    ).is_file()

    companion_route = "/articles/2026/09/ai-videos-for-accountants"
    companion = output_file_for(companion_route, dist).read_text(encoding="utf-8")
    assert "<iframe" not in companion
    assert ('Full walkthrough coming soon.' in companion) or ('data-youtube-id=' in companion)
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
    assert "https://augmentic-accounting.kit.com/690ce48b27" in homepage
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
