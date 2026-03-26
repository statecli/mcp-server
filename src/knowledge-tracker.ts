import { pipeline } from '@xenova/transformers';

export class KnowledgeTracker {
  private qaPipeline: any = null;

  constructor(private statecli: any) {}

  private async getExtractor() {
    if (!this.qaPipeline) {
        // Init DistilBERT ultra-fast local pipeline (~50MB footprint)
        this.qaPipeline = await pipeline('question-answering', 'Xenova/distilbert-base-cased-distilled-squad');
    }
    return this.qaPipeline;
  }

  /**
   * Performs a lightweight HTML scrape to simulate web searching
   * without needing an API key. Funnels telemetry in MCP.
   */
  async searchWeb(query: string): Promise<string> {
     try {
       const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
       if (!res.ok) {
           return "Search failed: Rate limited or unavailable. Please try another query.";
       }
       const html = await res.text();
       
       const results: string[] = [];
       const snippetMatches = html.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi);
       const urlMatches = html.match(/<a class="result__url[^>]*>([\s\S]*?)<\/a>/gi);
       
       if (!snippetMatches || snippetMatches.length === 0) {
           return "No results found.";
       }
       
       for (let i = 0; i < Math.min(5, snippetMatches.length); i++) {
           const text = snippetMatches[i].replace(/<[^>]*>?/gm, '').replace(/\s\s+/g, ' ').trim();
           const url = urlMatches && urlMatches[i] ? urlMatches[i].replace(/<[^>]*>?/gm, '').trim() : '';
           results.push(`[${i+1}] ${text}\nURL: ${url}`);
       }
       return results.join('\n\n');
     } catch (e) {
       return `Search failed: ${e instanceof Error ? e.message : String(e)}`;
     }
  }

  /**
   * Fetches a webpage and strictly returns raw text content,
   * bypassing expensive API scraping limits.
   * If a query is passed, triggers the local AI Extractor proxy.
   */
  async readUrl(url: string, query?: string): Promise<string> {
     try {
       const res = await fetch(url);
       if (!res.ok) {
           return `Failed to read URL: Status ${res.status}`;
       }
       const text = await res.text();
       
       let clean = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
       clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
       clean = clean.replace(/<[^>]*>?/gm, ' ');
       clean = clean.replace(/\s\s+/g, ' ').trim();
       
       if (query) {
           const startTime = Date.now();
           const extractor = await this.getExtractor();
           
           // Context window constrained for reliable Transformer inference
           const contextStr = clean.substring(0, 4000);
           
           const result = await extractor(query, contextStr);
           const duration = Date.now() - startTime;
           
           return `[Local AI Extraction - ${duration}ms]\nQuestion: ${query}\nExtract: ${result.answer}\nConfidence: ${Math.round(result.score * 100)}%\n\n---\nFull text preview:\n${clean.substring(0, 1500)}...`;
       }
       
       return clean.substring(0, 8000) + (clean.length > 8000 ? '\n...[Content Truncated]' : '');
     } catch (e) {
       return `Failed to read URL: ${e instanceof Error ? e.message : String(e)}`;
     }
  }
}
