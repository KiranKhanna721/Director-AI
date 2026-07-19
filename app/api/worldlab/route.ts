import { NextResponse } from "next/server";
import { startGeneration, pollOperation, isConfigured } from "@/lib/worldlab.server";

export const dynamic = "force-dynamic";

/**
 * Build a rich, actionable message from an error. Node's global fetch throws a
 * generic "fetch failed" TypeError and hides the real reason in `.cause` (a
 * DNS/TLS/proxy error with a `.code`). We surface that code so the on-screen
 * banner and the server terminal both explain WHY the call failed.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "World Labs request failed";
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    return `${err.message}${code ? ` [${code}]` : ""}: ${cause.message}`;
  }
  return err.message;
}

/**
 * POST /api/worldlab   { prompt }        -> starts a Marble job
 * GET  /api/worldlab?id=<operation_id>   -> polls that job once
 *
 * The API key stays here on the server. Responses are always 200 with a
 * normalized body so the client can branch without try/catch on status codes:
 *   { configured: boolean, marble: MarbleWorld | null }
 */
export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ configured: false, marble: null });
  }

  let prompt = "";
  try {
    const body = (await req.json()) as { prompt?: string };
    prompt = (body.prompt ?? "").trim();
  } catch {
    /* fall through */
  }
  if (!prompt) {
    return NextResponse.json({
      configured: true,
      marble: { status: "failed", message: "Missing prompt" },
    });
  }

  try {
    const operationId = await startGeneration(prompt);
    return NextResponse.json({
      configured: true,
      marble: { status: "processing", operationId },
    });
  } catch (err) {
    console.error("[worldlab] start generation failed:", err);
    return NextResponse.json({
      configured: true,
      marble: { status: "failed", message: describeError(err) },
    });
  }
}

export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ configured: false, marble: null });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({
      configured: true,
      marble: { status: "failed", message: "Missing operation id" },
    });
  }

  try {
    const marble = await pollOperation(id);
    return NextResponse.json({ configured: true, marble });
  } catch (err) {
    console.error("[worldlab] poll failed:", err);
    return NextResponse.json({
      configured: true,
      marble: { status: "failed", operationId: id, message: describeError(err) },
    });
  }
}
