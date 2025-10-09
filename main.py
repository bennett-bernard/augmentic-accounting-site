from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from markdown import markdown
from fastapi.staticfiles import StaticFiles
import mimetypes
import os
import frontmatter
from slugify import slugify

app = FastAPI()
templates = Jinja2Templates(directory="templates")

# Ensure correct MIME types for static assets on minimal images
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def home(request: Request):
    articles = []
    # Loop through years
    for year_folder in os.listdir("articles"):
        year_path = f"articles/{year_folder}"
        if os.path.isdir(year_path):
            # Loop through months
            for month_folder in os.listdir(year_path):
                month_path = f"{year_path}/{month_folder}"
                if os.path.isdir(month_path):
                    # Loop through articles
                    for filename in os.listdir(month_path):
                        if filename.endswith(".md"):
                            file_path = f"{month_path}/{filename}"
                            post = frontmatter.load(file_path)
                            
                            articles.append({
                                "year": year_folder,
                                "month": month_folder,
                                "slug": os.path.splitext(filename)[0],
                                "metadata": post.metadata
                            })

    return templates.TemplateResponse("index.html", {"request": request, "articles": articles})

@app.get("/about")
def about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})


@app.get("/articles")
def list_all_articles(request: Request):
    articles = []
    # Loop through years
    for year_folder in os.listdir("articles"):
        year_path = f"articles/{year_folder}"
        if os.path.isdir(year_path):
            # Loop through months
            for month_folder in os.listdir(year_path):
                month_path = f"{year_path}/{month_folder}"
                if os.path.isdir(month_path):
                    # Loop through articles
                    for filename in os.listdir(month_path):
                        if filename.endswith(".md"):
                            file_path = f"{month_path}/{filename}"
                            post = frontmatter.load(file_path)
                            articles.append({
                                "year": year_folder,
                                "month": month_folder,
                                "slug": os.path.splitext(filename)[0],
                                "metadata": post.metadata
                            })

    # Sort by publish date (expects ISO format like YYYY-MM-DD)
    articles.sort(
        key=lambda a: str(
            a.get("metadata", {}).get("publish_date")
            or a.get("metadata", {}).get("date")
            or ""
        ),
        reverse=True,
    )

    return templates.TemplateResponse(
        "article-list.html", {"request": request, "articles": articles}
    )

@app.get("/articles/{year}")
def list_articles_by_year(request: Request, year: str):
    articles = []
    year_path = f"articles/{year}"
    if os.path.isdir(year_path):
        for month_folder in os.listdir(year_path):
            month_path = f"{year_path}/{month_folder}"
            if os.path.isdir(month_path):
                for filename in os.listdir(month_path):
                    if filename.endswith(".md"):
                        file_path = f"{month_path}/{filename}"
                        post = frontmatter.load(file_path)
                        articles.append({
                            "year": year,
                            "month": month_folder,
                            "slug": os.path.splitext(filename)[0],
                            "metadata": post.metadata
                        })

    # Sort by publish date (expects ISO format like YYYY-MM-DD)
    articles.sort(
        key=lambda a: str(
            a.get("metadata", {}).get("publish_date")
            or a.get("metadata", {}).get("date")
            or ""
        ),
        reverse=True,
    )

    return templates.TemplateResponse(
        "article-list.html", {"request": request, "articles": articles, "year": year}
    )

@app.get("/articles/{year}/{month}")
def list_articles_by_month(request: Request, year: str, month: str):
    articles = []
    month_dir = f"articles/{year}/{month}"
    if os.path.isdir(month_dir):
        for filename in os.listdir(month_dir):
            if filename.endswith(".md"):
                file_path = f"{month_dir}/{filename}"
                post = frontmatter.load(file_path)
                articles.append({
                    "year": year,
                    "month": month,
                    "slug": os.path.splitext(filename)[0],
                    "metadata": post.metadata
                })

    # Sort by publish date (expects ISO format like YYYY-MM-DD)
    articles.sort(
        key=lambda a: str(
            a.get("metadata", {}).get("publish_date")
            or a.get("metadata", {}).get("date")
            or ""
        ),
        reverse=True,
    )

    return templates.TemplateResponse(
        "article-list.html", {"request": request, "articles": articles, "year": year, "month": month}
    )

@app.get("/articles/{year}/{month}/{article_name}")
def get_article(request: Request, year: str, month: str, article_name: str):
    # Construct the full path to the article file
    file_path = f"articles/{year}/{month}/{article_name}.md"


    # Check if the file exists to avoid errors
    if not os.path.exists(file_path):
        # Or return an appropriate error template
        return {"error": "Article not found"}

    post = frontmatter.load(file_path)

    html_content = markdown(post.content)

    # Pass the HTML content and title to the template
    return templates.TemplateResponse(
        "article-detail.html", {"request": request, "content": html_content, "metadata": post.metadata}
    )