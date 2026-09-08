"""Published article data shared by the static build and the agent demo."""
from pathlib import Path
from urllib.parse import quote

import frontmatter

ORIGIN = "https://augmenticaccounting.com"


def load_articles(directory: Path = Path("articles")) -> list[dict]:
    articles = []
    for path in directory.glob("*/*/*.md"):
        post = frontmatter.load(path)
        article_id = path.relative_to(directory).with_suffix("").as_posix()
        title = str(post.metadata.get("title") or path.stem)
        date = str(post.metadata.get("publish_date") or post.metadata.get("date") or "")
        excerpt = str(post.metadata.get("excerpt") or "")
        tags = post.metadata.get("tags") or []
        url = ORIGIN + "/articles/" + quote(article_id, safe="/")
        markdown = f"# {title}\n\nPublished: {date}\nSource: {url}\n\n"
        if excerpt:
            markdown += excerpt + "\n\n"
        markdown += post.content
        youtube_id = str(post.metadata.get("youtube_id") or "")
        if len(youtube_id) == 11 and all(c.isalnum() or c in "_-" for c in youtube_id):
            markdown += f"\n\nWatch the walkthrough: https://www.youtube.com/watch?v={youtube_id}\n"
        articles.append({
            "id": article_id,
            "title": title,
            "date": date,
            "excerpt": excerpt,
            "tags": [str(tag) for tag in tags] if isinstance(tags, list) else [],
            "url": url,
            "resourceUri": "augmentic://articles/" + quote(article_id, safe="/"),
            "markdown": markdown,
        })
    return sorted(articles, key=lambda article: (article["date"], article["id"]), reverse=True)
