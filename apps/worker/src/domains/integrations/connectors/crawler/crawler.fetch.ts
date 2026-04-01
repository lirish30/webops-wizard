export interface CrawlerPageFetchEngine {
  mode: "html";
  fetch(input: {
    url: string;
    userAgent: string;
    timeoutMs: number;
  }): Promise<{
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    contentType: string | null;
    html: string | null;
  }>;
}

export class DefaultCrawlerPageFetchEngine implements CrawlerPageFetchEngine {
  readonly mode = "html" as const;

  async fetch(input: {
    url: string;
    userAgent: string;
    timeoutMs: number;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const response = await fetch(input.url, {
        headers: {
          "user-agent": input.userAgent
        },
        redirect: "follow",
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type");
      const html =
        contentType && contentType.toLowerCase().includes("text/html")
          ? await response.text()
          : null;

      return {
        requestedUrl: input.url,
        finalUrl: response.url || input.url,
        statusCode: response.status,
        contentType,
        html
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
