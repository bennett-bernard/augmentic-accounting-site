// The same search logic runs in the Worker and the browser demo.
export function summarizeArticle({ markdown, ...article }) {
  return article;
}

export function searchArticles(articles, query, limit = 5) {
  const terms = query.toLocaleLowerCase("en-US").trim().split(/\s+/u).filter(Boolean);
  const matches = articles.map(article => {
    const title = article.title.toLocaleLowerCase("en-US");
    const summary = `${article.excerpt} ${article.tags.join(" ")}`.toLocaleLowerCase("en-US");
    const body = article.markdown.toLocaleLowerCase("en-US");
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      else if (summary.includes(term)) score += 3;
      else if (body.includes(term)) score += 1;
      else return null;
    }
    return { article, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.article.date.localeCompare(a.article.date) || a.article.id.localeCompare(b.article.id));
  return {
    query: query.trim(),
    total: matches.length,
    articles: matches.slice(0, limit).map(({ article }) => summarizeArticle(article)),
  };
}
