from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from markdown import markdown
import os

app = FastAPI()
templates = Jinja2Templates(directory="templates")

@app.get("/")
def home(request: Request):
    articles = [f for f in os.listdir("articles") if f.endswith(".md")]
    return templates.TemplateResponse("index.html", {"request": request, "articles": articles})

@app.get("/articles/{article_name}")
def get_article(request: Request, article_name: str):
    # Construct the full path to the article file
    file_path = f"articles/{article_name}"
    
    # Check if the file exists to avoid errors
    if not os.path.exists(file_path):
        # Or return an appropriate error template
        return {"error": "Article not found"}

    with open(file_path, "r", encoding="utf-8") as f:
        markdown_content = f.read()

    # Convert the markdown content to HTML
    html_content = markdown(markdown_content)
    
    # Pass the HTML content to the template
    return templates.TemplateResponse(
        "article.html", {"request": request, "content": html_content}
    )