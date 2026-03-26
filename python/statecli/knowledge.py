"""
StateCLI Python Knowledge Tracker
Provides web search and URL reading matching the TypeScript KnowledgeTracker
"""
import re
import urllib.request
import urllib.parse
from typing import Optional


def search_web(query: str, num_results: int = 5) -> str:
    """
    Search the web via DuckDuckGo HTML scraping (no API key required).
    Returns formatted snippets and URLs.
    """
    try:
        encoded = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "StateCLI-Agent/0.5.0 (knowledge-tracker)"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # Extract result snippets
        snippets = re.findall(r'<a class="result__snippet[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)
        urls = re.findall(r'<a class="result__url[^"]*"[^>]*>(.*?)</a>', html, re.DOTALL)

        if not snippets:
            return "No results found."

        results = []
        for i, snippet in enumerate(snippets[:num_results]):
            text = re.sub(r'<[^>]+>', '', snippet).strip()
            text = re.sub(r'\s+', ' ', text)
            url_text = re.sub(r'<[^>]+>', '', urls[i]).strip() if i < len(urls) else ""
            results.append(f"[{i+1}] {text}\nURL: {url_text}")

        return "\n\n".join(results)

    except Exception as e:
        return f"Search failed: {e}"


def read_url(url: str, query: Optional[str] = None, max_chars: int = 8000) -> str:
    """
    Fetch a URL and return clean text content.
    If query is provided, attempts basic keyword extraction as a lightweight proxy.
    """
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "StateCLI-Agent/0.5.0 (knowledge-tracker)"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # Strip scripts, styles, and HTML tags
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        clean = re.sub(r'<[^>]+>', ' ', html)
        clean = re.sub(r'\s+', ' ', clean).strip()

        if query:
            # Lightweight keyword extraction — find the most relevant sentences
            sentences = re.split(r'(?<=[.!?])\s+', clean)
            query_words = set(query.lower().split())
            scored = []
            for s in sentences:
                score = sum(1 for w in query_words if w in s.lower())
                if score > 0:
                    scored.append((score, s))
            scored.sort(key=lambda x: -x[0])
            best = " ".join(s for _, s in scored[:5])
            return f"[Keyword Extraction]\nQuestion: {query}\nExtract: {best}\n\n---\nFull text preview:\n{clean[:1500]}..."

        return clean[:max_chars] + ("\n...[Content Truncated]" if len(clean) > max_chars else "")

    except Exception as e:
        return f"Failed to read URL: {e}"
