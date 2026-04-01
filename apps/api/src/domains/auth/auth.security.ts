import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

type JwtPayloadBase = {
  sub: string;
  sid: string;
  typ: "access";
  activeWorkspaceId: string | null;
  iat: number;
  exp: number;
};

export type AccessTokenPayload = JwtPayloadBase;

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signAccessToken(
  payload: Omit<JwtPayloadBase, "iat" | "exp">,
  secret: string,
  ttlSeconds: number
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenPayload: JwtPayloadBase = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds
  };

  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(tokenPayload));
  const unsignedToken = `${header}.${body}`;
  const signature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(
  token: string,
  secret: string
): { payload: AccessTokenPayload | null; expired: boolean } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { payload: null, expired: false };
  }

  const header = parts[0];
  const body = parts[1];
  const signature = parts[2];
  if (!header || !body || !signature) {
    return { payload: null, expired: false };
  }
  const unsignedToken = `${header}.${body}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  if (signature.length !== expectedSignature.length) {
    return { payload: null, expired: false };
  }

  const signatureMatch = timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!signatureMatch) {
    return { payload: null, expired: false };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(decodeBase64Url(body));
  } catch {
    return { payload: null, expired: false };
  }

  if (
    typeof parsedPayload !== "object" ||
    parsedPayload === null ||
    !("sub" in parsedPayload) ||
    !("sid" in parsedPayload) ||
    !("typ" in parsedPayload) ||
    !("exp" in parsedPayload)
  ) {
    return { payload: null, expired: false };
  }

  const payload = parsedPayload as AccessTokenPayload;
  if (payload.typ !== "access") {
    return { payload: null, expired: false };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return { payload: null, expired: true };
  }

  return { payload, expired: false };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateRandomToken(length = 32): string {
  return randomBytes(length).toString("base64url");
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 64);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifySecret(secret: string, storedHash: string): boolean {
  const [saltPart, hashPart] = storedHash.split(".");
  if (!saltPart || !hashPart) {
    return false;
  }

  const salt = Buffer.from(saltPart, "base64url");
  const expectedHash = Buffer.from(hashPart, "base64url");
  const candidateHash = scryptSync(secret, salt, expectedHash.length);

  if (candidateHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(candidateHash, expectedHash);
}
