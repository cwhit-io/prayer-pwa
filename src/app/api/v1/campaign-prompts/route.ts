import {
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  jsonError,
  readJsonBody,
  requireApiAuth
} from "@/lib/api-auth";
import { createPrayerPrompt } from "@/lib/prompts";
import { filterReservedStepTagNames } from "@/lib/tags";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/campaign-prompts
 * Create a campaign (supplication) prayer prompt from an external service.
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

  const title = asString(body.title);
  const textBody = asString(body.body);
  const tags = filterReservedStepTagNames(asStringArray(body.tags));
  const scriptureReference = asString(body.scriptureReference || body.scripture_reference) || null;
  const scriptureText = asString(body.scriptureText || body.scripture_text) || null;
  const publishDateRaw = asString(body.publishDate || body.publish_date);
  const publishDate =
    publishDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(publishDateRaw)
      ? publishDateRaw
      : new Date().toISOString().slice(0, 10);
  const isActive = asBoolean(body.isActive ?? body.is_active, true);

  if (!title || !textBody) {
    return jsonError("title and body are required.", 400);
  }
  if (tags.length === 0) {
    return jsonError(
      "At least one topical tag is required (tags: string[]). Do not use Adoration, Confession, Thanksgiving, or Supplication as tags — those are ACTS steps.",
      400
    );
  }

  try {
    const created = await createPrayerPrompt({
      title,
      body: textBody,
      tags,
      scriptureReference,
      scriptureText,
      publishDate,
      isActive,
      createdBy: null
    });

    return Response.json(
      {
        ok: true,
        id: created.id,
        type: "campaign_prompt",
        title,
        tags,
        publishDate,
        isActive
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create campaign prompt.";
    return jsonError(message, 500);
  }
}
