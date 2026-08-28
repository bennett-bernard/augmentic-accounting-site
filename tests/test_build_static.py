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
