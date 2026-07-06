import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new NextResponse("Missing url", { status: 400 });

  // Use the URL as-is. Cloudinary raw resources do NOT support URL-based
  // transformations (like fl_attachment:false), so injecting them causes a 404.
  // We override Content-Disposition ourselves in the response below, which is
  // what actually controls whether the browser shows inline vs download.
  const fetchUrl = rawUrl;

  try {
    const upstream = await fetch(fetchUrl, {
      headers: {
        Accept: "application/pdf,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; IndusERP/1.0)",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new NextResponse(
        `Cloudinary returned ${upstream.status} for the PDF URL. The file may have been deleted or the URL is invalid.`,
        { status: upstream.status }
      );
    }

    const bytes = await upstream.arrayBuffer();

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",   // ← This is what makes the browser show it inline
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e: unknown) {
    return new NextResponse(
      `Could not load PDF: ${e instanceof Error ? e.message : String(e)}`,
      { status: 502 }
    );
  }
}
