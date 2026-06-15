/**
 * Converts standard YouTube URLs into embeddable URLs
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  let videoId: string | null = null;
  
  try {
    let trimmed = url.trim();
    // Prepend https:// if protocol is missing
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = "https://" + trimmed;
    }

    if (trimmed.includes("youtu.be/")) {
      videoId = trimmed.split("youtu.be/")[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes("youtube.com/watch")) {
      const urlObj = new URL(trimmed);
      videoId = urlObj.searchParams.get("v");
    } else if (trimmed.includes("youtube.com/embed/")) {
      videoId = trimmed.split("youtube.com/embed/")[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes("youtube.com/shorts/")) {
      videoId = trimmed.split("youtube.com/shorts/")[1]?.split(/[?#]/)[0] || null;
    } else if (trimmed.includes("youtube.com/live/")) {
      videoId = trimmed.split("youtube.com/live/")[1]?.split(/[?#]/)[0] || null;
    }
  } catch (e) {
    console.error("Error parsing YouTube URL:", e);
  }

  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

/**
 * Converts standard Canva design link into embeddable URL
 * Supports:
 * - https://www.canva.com/design/DAFv7Z6-FvQ/view
 * - https://www.canva.com/design/DAFv7Z6-FvQ/watch
 * - https://www.canva.com/design/DAFv7Z6-FvQ/view?embed
 */
export function getCanvaEmbedUrl(url: string): string | null {
  if (!url) return null;

  try {
    const trimmed = url.trim();
    
    // Extract design ID from URL
    // Format: canva.com/design/DESIGN_ID/...
    if (trimmed.includes("canva.com/design/")) {
      const parts = trimmed.split("canva.com/design/");
      if (parts.length > 1) {
        const designId = parts[1].split("/")[0]?.split(/[?#]/)[0];
        if (designId) {
          return `https://www.canva.com/design/${designId}/view?embed`;
        }
      }
    }
  } catch (e) {
    console.error("Error parsing Canva URL:", e);
  }

  return null;
}

/**
 * Checks if the URL is a short link (canva.link) and resolves it using the server API.
 * Returns the resolved full Canva URL or the original URL if not a short link or error.
 */
export async function resolveCanvaUrlIfNeeded(url: string): Promise<string> {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.includes("canva.link")) {
    try {
      const res = await fetch(`/api/resolve-canva?url=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.resolvedUrl) {
          return data.resolvedUrl;
        }
      }
    } catch (e) {
      console.error("Failed to auto-resolve short link:", e);
    }
  }
  return trimmed;
}
