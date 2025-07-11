import { Buffer } from "node:buffer";

const { GLOO_AI_CLIENT_ID, GLOO_AI_CLIENT_SECRET, GLOO_AI_CLIENT_TOKEN } =
  process.env;

console.log("[GLOO_DEBUG] Environment variables loaded:", {
  GLOO_AI_CLIENT_ID: GLOO_AI_CLIENT_ID ? `${GLOO_AI_CLIENT_ID.slice(0, 10)}...` : "NOT SET",
  GLOO_AI_CLIENT_SECRET: GLOO_AI_CLIENT_SECRET ? `${GLOO_AI_CLIENT_SECRET.slice(0, 10)}...` : "NOT SET",
  GLOO_AI_CLIENT_TOKEN: GLOO_AI_CLIENT_TOKEN ? `${GLOO_AI_CLIENT_TOKEN.slice(0, 10)}...` : "NOT SET",
});

if (!GLOO_AI_CLIENT_ID || !GLOO_AI_CLIENT_SECRET || !GLOO_AI_CLIENT_TOKEN) {
  console.error("[GLOO_DEBUG] Missing required environment variables");
  throw new Error("Gloo AI client credentials not configured");
}

const bufferTimeMs = 5 * 60 * 1000;
const tokenExpirationMs = () => _tokenExpiration * 1000;
const tokenAboutToExpire = () =>
  Date.now() > tokenExpirationMs() - bufferTimeMs;
const tokenExpired = () => Date.now() > tokenExpirationMs();

let _accessToken: string = GLOO_AI_CLIENT_TOKEN;
let _tokenExpiration = Date.now() + bufferTimeMs;

export const accessToken: () => string = () => {
  console.log("[GLOO_DEBUG] accessToken called", {
    tokenExpired: tokenExpired(),
    tokenAboutToExpire: tokenAboutToExpire(),
    hasAccessToken: !!_accessToken,
    tokenExpiration: _tokenExpiration,
    currentTime: Date.now(),
  });

  if (tokenExpired()) {
    console.error("[GLOO_DEBUG] Token expired, throwing error");
    throw new Error("Token expired");
  }
  if (tokenAboutToExpire()) {
    console.log("[GLOO_DEBUG] Token about to expire, refreshing asynchronously");
    getAccessToken().then(({ access_token, expiration }) => {
      console.log("[GLOO_DEBUG] Token refreshed successfully");
      _accessToken = access_token;
      _tokenExpiration = expiration;
    }).catch((error) => {
      console.error("[GLOO_DEBUG] Token refresh failed:", error);
    });
  }
  if (!_accessToken) {
    console.error("[GLOO_DEBUG] No access token available, throwing error");
    throw new Error("Token not initialized");
  }
  
  console.log("[GLOO_DEBUG] Returning access token:", `${_accessToken.slice(0, 20)}...`);
  return _accessToken;
};

interface AccessTokenResponse {
  access_token: string;
  expiration: number;
}

export async function getAccessToken(
  clientId = GLOO_AI_CLIENT_ID,
  clientSecret = GLOO_AI_CLIENT_SECRET,
): Promise<AccessTokenResponse> {
  console.log("[GLOO_DEBUG] getAccessToken called");
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  console.log("[GLOO_DEBUG] Auth header created:", `Basic ${auth.slice(0, 20)}...`);

  const requestBody = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "api/access",
  });

  console.log("[GLOO_DEBUG] Making OAuth request to Gloo AI");
  
  try {
    const response = await fetch("https://platform.ai.gloo.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: requestBody,
    });

    console.log("[GLOO_DEBUG] OAuth response received:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GLOO_DEBUG] OAuth request failed:", errorText);
      throw new Error(`OAuth request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log("[GLOO_DEBUG] OAuth response data:", {
      hasAccessToken: !!data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
    });

    if (!data.access_token) {
      console.error("[GLOO_DEBUG] No access token in response:", data);
      throw new Error("No access token received from OAuth endpoint");
    }

    // Check token expiration
    const tokenParts = data.access_token.split(".");
    if (tokenParts.length !== 3) {
      console.error("[GLOO_DEBUG] Invalid JWT token format");
      throw new Error("Invalid JWT token format");
    }

    const decoded = JSON.parse(
      Buffer.from(tokenParts[1], "base64").toString(),
    );
    const expiration = decoded.exp;
    console.log("[GLOO_DEBUG] Token decoded successfully:", {
      expiration,
      currentTime: Date.now(),
      expiresInMs: expiration * 1000,
      validFor: (expiration * 1000 - Date.now()) / 1000 / 60,
    });

    /** @todo reconcile redundant writes to _accessToken and _tokenExpiration */
    _accessToken = data.access_token;
    _tokenExpiration = expiration;
    
    console.log("[GLOO_DEBUG] Token stored successfully");
    
    return {
      access_token: _accessToken,
      expiration: _tokenExpiration,
    };
  } catch (error) {
    console.error("[GLOO_DEBUG] getAccessToken error:", error);
    throw error;
  }
}
