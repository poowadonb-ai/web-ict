import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    let currentUrl = targetUrl.trim();
    let redirectCount = 0;
    const maxRedirects = 5;

    while (redirectCount < maxRedirects) {
      if (currentUrl.includes("canva.com/design/")) {
        break;
      }

      // Check if it is a short link or redirector
      if (!currentUrl.includes("canva.link") && !currentUrl.includes("shorturl") && !currentUrl.includes("bit.ly")) {
        break;
      }

      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return NextResponse.json({ resolvedUrl: currentUrl });
  } catch (error) {
    console.error("Error resolving URL:", error);
    const msg = error instanceof Error ? error.message : "Failed to resolve URL";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
