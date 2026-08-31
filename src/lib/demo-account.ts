/** Video/demo login. Off unless explicitly re-enabled. Never send a real OTP to this number while enabled. */
export const DEMO_ACCOUNT_ENABLED = false;
export const DEMO_ACCOUNT_NAME = "Alex";
export const DEMO_LOGIN_CODE = "000000";
export const DEMO_PHONE_NORMALIZED = "+12602767404";
export const DEMO_ACCOUNT_EMAIL = "phone-12602767404@unlinked.local";

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function isDemoPhone(value: string) {
  return phoneDigits(value) === "2602767404";
}

export function isDemoLoginContact(type: string, normalized: string) {
  return DEMO_ACCOUNT_ENABLED && type === "phone" && isDemoPhone(normalized);
}

export function isDemoLoginCode(code: string) {
  return code.trim() === DEMO_LOGIN_CODE;
}
