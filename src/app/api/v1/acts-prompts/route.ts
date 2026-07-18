import {
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  jsonError,
  readJsonBody,
  requireApiAuth
} from "@/lib/api-auth";
import { createActsPrompt, parseActsStepLetter } from "@/lib/acts-prompts";
import { filterReservedStepTagNames } from "@/lib/tags";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/acts-prompts
 * Create an ACTS (A/C/T) guide prompt from an external service.
 *
 * Auth: Authorization: Bearer <api_token>
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = asRecord(await readJsonBody(request));
  if (!body) {
    return jsonError("JSON body is required.", 400);
  }

  const step = parseActsStepLetter(asString(body.step));
  const title = asString(body.title);
  const textBody = asString(body.body);
  const tags = filterReservedStepTagNames(asStringArray(body.tags));
  const scriptureReference = asString(body.scriptureReference || body.scripture_reference) || null;
  const scriptureText = asString(body.scriptureText || body.scripture_text) || null;
  const isActive = asBoolean(body.isActive ?? body.is_active, true);

  if (!step) {
    return jsonError("step must be A, C, T (or Adoration / Confession / Thanksgiving).", 400);
  }
  if (!title || !textBody) {
    return jsonError("title and body are required.", 400);
  }

  try {
    const created = await createActsPrompt({
      step,
      title,
      body: textBody,
      scriptureReference,
      scriptureText,
      isActive,
      tags
    });

    return Response.json(
      {
        ok: true,
        id: created.id,
        type: "acts_prompt",
        step,
        title,
        tags,
        isActive
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create ACTS prompt.";
    return jsonError(message, 500);
  }
}
