"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const STORAGE_KEY = "plc_login_challenge";

type StoredLoginChallenge = {
  challenge: string;
  verified?: string | null;
  next?: string | null;
};

function readStoredChallenge(): StoredLoginChallenge | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredLoginChallenge;
    if (!parsed?.challenge || typeof parsed.challenge !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredLoginChallenge() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
}

export function AuthChallengeRestore() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const challenge = params.get("challenge");
    const verified = params.get("verified");
    const next = params.get("next");

    if (challenge) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ challenge, verified, next } satisfies StoredLoginChallenge)
        );
      } catch {
        // sessionStorage may be unavailable
      }
      return;
    }

    const stored = readStoredChallenge();
    if (!stored) {
      return;
    }

    const query = new URLSearchParams();
    query.set("challenge", stored.challenge);
    if (stored.verified) {
      query.set("verified", stored.verified);
    }
    if (stored.next) {
      query.set("next", stored.next);
    }
    router.replace(`/auth?${query.toString()}`);
  }, [params, router]);

  return null;
}

export function ClearStoredLoginChallenge() {
  useEffect(() => {
    clearStoredLoginChallenge();
  }, []);
  return null;
}

export function StartOverLink({
  href,
  className,
  children
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => clearStoredLoginChallenge()}>
      {children}
    </Link>
  );
}
