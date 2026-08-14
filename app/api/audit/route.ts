import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit-runner";

type AuditRequest = {
  url?: string;
  maxPages?: number;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as AuditRequest;

    const rawUrl =
      typeof body.url === "string"
        ? body.url.trim()
        : "";

    if (!rawUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Website URL is required.",
        },
        { status: 400 }
      );
    }

    if (!isValidHttpUrl(rawUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid HTTP or HTTPS website URL.",
        },
        { status: 400 }
      );
    }

    const maxPages =
  typeof body.maxPages === "number"
    ? Math.max(
        1,
        Math.min(
          Math.floor(body.maxPages),
          150
        )
      )
    : 150;

    const audit =
      await runAudit(
        rawUrl,
        {
          maxPages,
        }
      );

    return NextResponse.json(
      {
        success: true,
        data: audit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Audit API error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message.includes(
        "cancelled"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Website audit was cancelled.",
        },
        { status: 499 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to complete the website audit. Please check the URL and try again.",
      },
      { status: 500 }
    );
  }
}
