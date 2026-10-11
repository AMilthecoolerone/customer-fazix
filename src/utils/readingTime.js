/**
 * Calculates reading time using the ApiVerve Reading Time API (https://api.apiverve.com/v1/readingtime)
 * with graceful fallback to standard word-count formula (200 wpm).
 */
export async function calculateReadingTime(text, wpm = 200) {
  const apiKey = process.env.APIVERVE_API_KEY;

  if (apiKey && text && text.trim().length > 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('https://api.apiverve.com/v1/readingtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          text: text.slice(0, 50000),
          wpm,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json?.status === 'ok' && json?.data?.reading_time_text) {
          return json.data.reading_time_text;
        }
      }
    } catch {
      // Gracefully fall back to local computation if network or API key issues arise
    }
  }

  // Fallback calculation: average 200 words per minute
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / wpm));
  return `${minutes} min read`;
}
