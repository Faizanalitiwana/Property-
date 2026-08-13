import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/url";
import { buildAuditResult } from "@/lib/audit";
import type { PageAudit } from "@/types/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();

  try {
    const body = await request.json();

    if (!body?.domain || typeof body.domain !== "string") {
      return NextResponse.json(
        {
          error: "Please enter a valid website domain."
        },
        {
          status: 400
        }
      );
    }

    const domainUrl = normalizeDomain(body.domain);

    const page: PageAudit = {
      url: domainUrl.toString(),
      status: null,
      finalUrl: domainUrl.toString(),
      contentType: "",
      title: "",
      metaDescription: "",
      h1Count: 0,
      canonical: "",
      robots: "",
      wordCount: 0,
      internalLinks: 0,
      externalLinks: 0,
      depth: 0
    };

    const result = buildAuditResult(
      domainUrl.hostname,
      [page],
      [
        {
          severity: "info",
          code: "AUDIT_INITIALIZED",
          title: "Audit initialized",
          detail:
            "The website audit workspace is ready. Full crawling will be enabled by the crawler phase."
        }
      ],
      startedAt
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit initialization error:", error);

    return NextResponse.json(
      {
        error:
          "We could not start the website audit. Please check the domain and try again."
      },
      {
        status: 500
      }
    );
  }
}
