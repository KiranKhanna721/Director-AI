// NOTE: server-only module. It is imported exclusively by app/api/worldlab/route.ts
// (a server route), so the API key in process.env never reaches the client
// bundle. The `.server.ts` suffix documents this intent.
import type { MarbleWorld } from "./types";

/**
 * ============================================================================
 *  World Labs (Marble) "World API" adapter — SERVER ONLY.
 * ============================================================================
 *  Contract from https://docs.worldlabs.ai/api
 *
 *    Base URL   : https://api.worldlabs.ai
 *    Generate   : POST /marble/v1/worlds:generate
 *    Poll       : GET  /marble/v1/operations/{operation_id}   (until done:true)
 *    Auth       : header  WLT-Api-Key: <key>
 *
 *  Generation is asynchronous and takes ~5 minutes, so this module does NOT
 *  block waiting for it. Instead:
 *    - startGeneration() kicks off the job and returns its operation_id.
 *    - pollOperation()   checks the job once and normalizes the result.
 *  The client polls pollOperation (via the GET route) on an interval, keeping
 *  the local scene instantly usable while Marble renders in the background.
 *
 *  Env (put the key in .env.local — see .env.local.example):
 *    WORLDLABS_API_KEY   (required to enable real generation)
 *    WORLDLABS_MODEL     default: marble-1.1   (or: marble-1.1-plus)
 *    WORLDLABS_API_BASE  default: https://api.worldlabs.ai
 * ============================================================================
 */

const BASE = process.env.WORLDLABS_API_BASE ?? "https://api.worldlabs.ai";
const MODEL = process.env.WORLDLABS_MODEL ?? "marble-1.1";
const KEY_HEADER = "WLT-Api-Key";

export function isConfigured(): boolean {
  return !!process.env.WORLDLABS_API_KEY;
}

function authHeaders(): Record<string, string> {
  return { [KEY_HEADER]: process.env.WORLDLABS_API_KEY ?? "" };
}

/** Safely read a nested string field, tolerating missing intermediate objects. */
function str(obj: unknown, path: string[]): string | undefined {
  let cur: unknown = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" && cur.length > 0 ? cur : undefined;
}

/**
 * Kick off a Marble generation job. Returns the operation_id to poll, or throws
 * (the route converts throws into a graceful "failed" result).
 */
export async function startGeneration(prompt: string): Promise<string> {
  if (!isConfigured()) throw new Error("WORLDLABS_API_KEY not set");

  const res = await fetch(`${BASE}/marble/v1/worlds:generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      // World Labs caps display_name at 64 characters.
      display_name: prompt.slice(0, 64),
      model: MODEL,
      world_prompt: { type: "text", text_prompt: prompt },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`create failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const operationId = data["operation_id"];
  if (typeof operationId !== "string" || !operationId) {
    throw new Error("create response had no operation_id");
  }
  return operationId;
}

/**
 * Poll a generation operation once and normalize it into a MarbleWorld.
 * - not done         -> { status: "processing", operationId }
 * - done with error  -> { status: "failed" }
 * - done with result -> { status: "completed", viewerUrl, previewImageUrl, ... }
 */
export async function pollOperation(operationId: string): Promise<MarbleWorld> {
  if (!isConfigured()) return { status: "failed", message: "WORLDLABS_API_KEY not set" };

  const res = await fetch(`${BASE}/marble/v1/operations/${encodeURIComponent(operationId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`poll failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (data["done"] !== true) {
    return { status: "processing", operationId };
  }

  if (data["error"]) {
    const msg = str(data, ["error", "message"]) ?? "Marble generation failed";
    return { status: "failed", operationId, message: msg };
  }

  const response = data["response"];
  return {
    status: "completed",
    operationId,
    viewerUrl: str(response, ["world_marble_url"]),
    previewImageUrl: str(response, ["assets", "thumbnail_url"]),
    meshUrl: str(response, ["assets", "mesh", "collider_mesh_url"]),
    panoUrl: str(response, ["assets", "imagery", "pano_url"]),
    caption: str(response, ["assets", "caption"]),
  };
}
