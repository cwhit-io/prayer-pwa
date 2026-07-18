import { getPlanningCenterCredentials } from "@/lib/settings";

type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | Array<{ id: string; type: string }> | null }>;
};

type JsonApiResponse = {
  data?: JsonApiResource | JsonApiResource[] | null;
  included?: JsonApiResource[];
  errors?: Array<{ detail?: string; title?: string }>;
  links?: { next?: string | null };
};

export type PcoPersonMatch = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

/** Login / household selection candidate (may include household context). */
export type PcoLoginCandidate = {
  personId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  householdId: string | null;
  householdName: string | null;
};

export type PcoRelatedPerson = {
  planningCenterPersonId: string;
  name: string;
  email: string | null;
  focusArea: "family" | "friends";
  sourceType: "household" | "small_group";
  sourceGroupPcId: string;
  sourceGroupName: string | null;
};

function authHeader(appId: string, secret: string) {
  return `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`;
}

async function pcoFetch(path: string, credentials: { appId: string; secret: string }) {
  const url = path.startsWith("http") ? path : `https://api.planningcenteronline.com${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader(credentials.appId, credentials.secret),
      Accept: "application/json"
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as JsonApiResponse;

  if (!response.ok) {
    const detail =
      payload.errors?.[0]?.detail ||
      payload.errors?.[0]?.title ||
      `Planning Center request failed (${response.status})`;
    throw new Error(detail);
  }

  return payload;
}

function personName(resource: JsonApiResource) {
  const first = String(resource.attributes?.first_name ?? "").trim();
  const last = String(resource.attributes?.last_name ?? "").trim();
  const name = `${first} ${last}`.trim() || String(resource.attributes?.name ?? "Unknown").trim();
  return { first, last, name };
}

function emailFromIncluded(personId: string, included: JsonApiResource[] = []) {
  const email = included.find(
    (item) =>
      item.type === "Email" &&
      item.relationships?.person?.data &&
      !Array.isArray(item.relationships.person.data) &&
      item.relationships.person.data.id === personId
  );
  return email?.attributes?.address ? String(email.attributes.address) : null;
}

export async function getPcoCredentialsOrThrow() {
  const credentials = await getPlanningCenterCredentials();
  if (!credentials.appId || !credentials.secret) {
    throw new Error("Planning Center API credentials are not configured.");
  }
  return { appId: credentials.appId, secret: credentials.secret };
}

export async function testPlanningCenterConnection() {
  const credentials = await getPcoCredentialsOrThrow();
  await pcoFetch("/people/v2/me", credentials);
  return true;
}

function mapPeopleFromPayload(payload: JsonApiResponse): PcoPersonMatch[] {
  const people = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  return people
    .filter((person) => person.type === "Person")
    .map((person) => {
      const { first, last, name } = personName(person);
      return {
        id: person.id,
        name,
        firstName: first,
        lastName: last,
        email: emailFromIncluded(person.id, payload.included)
      };
    });
}

function mergePersonMatches(...lists: PcoPersonMatch[][]) {
  const byId = new Map<string, PcoPersonMatch>();
  for (const list of lists) {
    for (const person of list) {
      const existing = byId.get(person.id);
      if (!existing) {
        byId.set(person.id, person);
        continue;
      }
      byId.set(person.id, {
        ...existing,
        email: existing.email || person.email,
        firstName: existing.firstName || person.firstName,
        lastName: existing.lastName || person.lastName,
        name: existing.name || person.name
      });
    }
  }
  return Array.from(byId.values());
}

/** Look up a person in Planning Center by email, name, or phone. */
export async function searchPlanningCenterPerson(queryText: string): Promise<PcoPersonMatch[]> {
  const credentials = await getPcoCredentialsOrThrow();
  const q = queryText.trim();
  if (!q) {
    return [];
  }

  const looksLikePhone = /\d{7,}/.test(q.replace(/\D/g, "")) && !q.includes("@");
  const digits = q.replace(/\D/g, "");
  const e164 =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : q.startsWith("+")
          ? `+${digits}`
          : null;

  const searches: string[] = [];
  if (looksLikePhone && e164) {
    searches.push(
      `/people/v2/people?where[search_phone_number_e164]=${encodeURIComponent(e164)}&per_page=25&include=emails`,
      `/people/v2/people?where[search_phone_number]=${encodeURIComponent(digits)}&per_page=25&include=emails`,
      `/people/v2/people?where[search_name_or_email_or_phone_number]=${encodeURIComponent(e164)}&per_page=25&include=emails`
    );
  } else {
    searches.push(
      `/people/v2/people?where[search_name_or_email]=${encodeURIComponent(q)}&per_page=25&include=emails`,
      `/people/v2/people?where[search_name_or_email_or_phone_number]=${encodeURIComponent(q)}&per_page=25&include=emails`
    );
  }

  const results: PcoPersonMatch[][] = [];
  for (const path of searches) {
    try {
      const payload = await pcoFetch(path, credentials);
      results.push(mapPeopleFromPayload(payload));
    } catch {
      // Try alternate search params; some orgs/tokens may not support every filter.
    }
  }

  return mergePersonMatches(...results);
}

/**
 * Resolve login candidates from a contact: search PCO, then expand each hit’s household
 * so the user can pick which household member they are.
 */
export async function findLoginCandidatesByContact(input: {
  contactType: "email" | "phone";
  contact: string;
}): Promise<PcoLoginCandidate[]> {
  const credentials = await getPcoCredentialsOrThrow();
  const matches = await searchPlanningCenterPerson(input.contact);
  if (matches.length === 0) {
    return [];
  }

  const byPersonId = new Map<string, PcoLoginCandidate>();

  function upsert(candidate: PcoLoginCandidate) {
    const existing = byPersonId.get(candidate.personId);
    if (!existing) {
      byPersonId.set(candidate.personId, candidate);
      return;
    }
    byPersonId.set(candidate.personId, {
      personId: candidate.personId,
      name: existing.name || candidate.name,
      firstName: existing.firstName || candidate.firstName,
      lastName: existing.lastName || candidate.lastName,
      email: existing.email || candidate.email,
      phone: existing.phone || candidate.phone,
      householdId: existing.householdId || candidate.householdId,
      householdName: existing.householdName || candidate.householdName
    });
  }

  for (const match of matches) {
    upsert({
      personId: match.id,
      name: match.name,
      firstName: match.firstName || null,
      lastName: match.lastName || null,
      email: match.email,
      phone: input.contactType === "phone" ? input.contact : null,
      householdId: null,
      householdName: null
    });

    try {
      const households = await fetchAllPages(`/people/v2/people/${match.id}/households`, credentials);
      for (const household of households.resources) {
        const members = await fetchAllPages(
          `/people/v2/households/${household.id}/people?per_page=100&include=emails`,
          credentials
        );
        for (const member of members.resources) {
          if (member.type !== "Person") {
            continue;
          }
          const { first, last, name } = personName(member);
          upsert({
            personId: member.id,
            name,
            firstName: first || null,
            lastName: last || null,
            email: emailFromIncluded(member.id, members.included),
            phone: input.contactType === "phone" ? input.contact : null,
            householdId: household.id,
            householdName: String(household.attributes?.name ?? "Household")
          });
        }
      }
    } catch {
      // Household expansion optional if permissions are limited.
    }
  }

  return Array.from(byPersonId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPlanningCenterPerson(personId: string): Promise<PcoPersonMatch | null> {
  const credentials = await getPcoCredentialsOrThrow();
  const payload = await pcoFetch(`/people/v2/people/${personId}?include=emails`, credentials);
  const person = payload.data && !Array.isArray(payload.data) ? payload.data : null;
  if (!person) {
    return null;
  }

  const { first, last, name } = personName(person);
  return {
    id: person.id,
    name,
    firstName: first,
    lastName: last,
    email: emailFromIncluded(person.id, payload.included)
  };
}

async function fetchAllPages(path: string, credentials: { appId: string; secret: string }) {
  const resources: JsonApiResource[] = [];
  const included: JsonApiResource[] = [];
  let next: string | null = path;

  while (next) {
    const payload = await pcoFetch(next, credentials);
    const pageData = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
    resources.push(...pageData);
    if (payload.included) {
      included.push(...payload.included);
    }
    next = payload.links?.next ?? null;
  }

  return { resources, included };
}

/**
 * Only groups whose GroupType id is in this set are used for Friends pull.
 * Same org API credentials (People + Groups) — no separate app keys.
 */
export const PCO_FRIENDS_GROUP_TYPE_IDS = new Set(["428832", "428831", "428830"]);

/** Pull household + small-group members for a linked PCO person. */
export async function fetchPrayerPeopleForPerson(personId: string): Promise<PcoRelatedPerson[]> {
  const credentials = await getPcoCredentialsOrThrow();
  const related: PcoRelatedPerson[] = [];
  const seen = new Set<string>();

  function add(person: PcoRelatedPerson) {
    if (person.planningCenterPersonId === personId) {
      return;
    }
    const key = `${person.focusArea}:${person.planningCenterPersonId}:${person.sourceGroupPcId}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    related.push(person);
  }

  // Households (Family)
  try {
    const households = await fetchAllPages(`/people/v2/people/${personId}/households`, credentials);
    for (const household of households.resources) {
      const members = await fetchAllPages(
        `/people/v2/households/${household.id}/people?per_page=100`,
        credentials
      );
      for (const member of members.resources) {
        if (member.type !== "Person") {
          continue;
        }
        const { name } = personName(member);
        add({
          planningCenterPersonId: member.id,
          name,
          email: null,
          focusArea: "family",
          sourceType: "household",
          sourceGroupPcId: household.id,
          sourceGroupName: String(household.attributes?.name ?? "Household")
        });
      }
    }
  } catch {
    // Households may be empty or restricted; continue with groups.
  }

  // Groups (Friends / small group) — same People/Groups API credentials.
  // Only groups in these Planning Center group *types* are used.
  // Endpoint: GET /groups/v2/people/{person_id}/groups
  try {
    const personGroups = await fetchAllPages(
      `/groups/v2/people/${personId}/groups?per_page=100`,
      credentials
    );

    const allowedGroups = personGroups.resources.filter((group) => {
      if (group.type !== "Group") {
        return false;
      }
      const groupTypeRel = group.relationships?.group_type?.data;
      const groupTypeId =
        groupTypeRel && !Array.isArray(groupTypeRel) ? groupTypeRel.id : null;
      return Boolean(groupTypeId && PCO_FRIENDS_GROUP_TYPE_IDS.has(groupTypeId));
    });

    for (const group of allowedGroups) {
      const groupName = String(group.attributes?.name ?? "Small group");

      const groupMembers = await fetchAllPages(
        `/groups/v2/groups/${group.id}/memberships?include=person&per_page=100`,
        credentials
      );

      for (const gm of groupMembers.resources) {
        const personRel = gm.relationships?.person?.data;
        const memberPersonId = personRel && !Array.isArray(personRel) ? personRel.id : null;
        if (!memberPersonId) {
          continue;
        }

        const person = groupMembers.included.find(
          (item) => item.type === "Person" && item.id === memberPersonId
        );
        const name = person
          ? personName(person).name
          : String(gm.attributes?.person_name ?? "Group member");

        add({
          planningCenterPersonId: memberPersonId,
          name,
          email: null,
          focusArea: "friends",
          sourceType: "small_group",
          sourceGroupPcId: group.id,
          sourceGroupName: groupName
        });
      }
    }
  } catch {
    // Groups product may be unavailable for this org or person.
  }

  return related;
}
