from pathlib import Path

import frontmatter
from fastapi.testclient import TestClient

from main import app


ROUTE = "/articles/2026/09/ai-videos-for-accountants"
ASSETS = "/static/video/ai-videos-for-accountants"


def test_pending_walkthrough_has_no_broken_or_empty_player(monkeypatch) -> None:
    post = frontmatter.load("articles/2026/09/ai-videos-for-accountants.md")
    post.metadata["youtube_id"] = ""
    monkeypatch.setattr("main.frontmatter.load", lambda _: post)
    with TestClient(app) as client:
        response = client.get(ROUTE)
    assert response.status_code == 200
    assert "Full walkthrough coming soon." in response.text
    assert 'data-youtube-id=' not in response.text
    assert '<iframe' not in response.text
    assert response.text.count('<video ') == 2


def test_uploaded_walkthrough_renders_accessible_player_link(monkeypatch) -> None:
    post = frontmatter.load("articles/2026/09/ai-videos-for-accountants.md")
    # A fixture ID only: never written to the actual article.
    post.metadata["youtube_id"] = "testVideo01"
    monkeypatch.setattr("main.frontmatter.load", lambda _: post)
    with TestClient(app) as client:
        response = client.get(ROUTE)
    assert response.status_code == 200
    assert 'data-youtube-id="testVideo01"' in response.text
    assert 'href="https://www.youtube.com/watch?v=testVideo01"' in response.text
    assert 'aria-label="Play the full walkthrough:' in response.text
    assert "Full walkthrough coming soon." not in response.text
    assert "<iframe" not in response.text


def test_example_videos_support_playback_and_seeking() -> None:
    with TestClient(app) as client:
        for filename in ("tax-return-summary.mp4", "puka-surfboards-pl.mp4"):
            response = client.get(f"{ASSETS}/{filename}", headers={"Range": "bytes=0-1023"})
            assert response.status_code == 206
            assert response.headers["content-type"] == "video/mp4"
            assert response.headers["accept-ranges"] == "bytes"
            source = Path(f"static/video/ai-videos-for-accountants/{filename}")
            assert response.headers["content-range"] == f"bytes 0-1023/{source.stat().st_size}"
            assert response.content == source.read_bytes()[:1024]
