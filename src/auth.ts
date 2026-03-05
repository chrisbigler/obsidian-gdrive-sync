import { requestUrl, Notice } from "obsidian";
import * as http from "http";
import type { GDriveSyncSettings } from "./types";

const REDIRECT_PORT = 42813;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export function clearTokenCache(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export async function getAccessToken(settings: GDriveSyncSettings): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!settings.refreshToken) {
    throw new Error("Not authorized. Please authorize with Google in plugin settings.");
  }

  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    refresh_token: settings.refreshToken,
    grant_type: "refresh_token",
  });

  const resp = await requestUrl({
    url: TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (resp.status !== 200) {
    throw new Error(`Token refresh failed (${resp.status}): ${resp.text}`);
  }

  const data = resp.json;
  cachedAccessToken = data.access_token;
  // Expire 60s early to avoid edge cases
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return cachedAccessToken!;
}

export function startOAuthFlow(
  settings: GDriveSyncSettings,
  onToken: (refreshToken: string) => Promise<void>
): void {
  if (!settings.clientId || !settings.clientSecret) {
    new Notice("Please enter Client ID and Client Secret first.");
    return;
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", settings.clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/callback")) {
      res.writeHead(404);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${REDIRECT_PORT}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>Authorization failed.</h2><p>You can close this tab.</p></body></html>");
      server.close();
      new Notice(`OAuth failed: ${error || "no code received"}`);
      return;
    }

    try {
      const tokenBody = new URLSearchParams({
        code,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      });

      const resp = await requestUrl({
        url: TOKEN_URL,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      });

      if (resp.status !== 200) {
        throw new Error(`Token exchange failed (${resp.status})`);
      }

      const data = resp.json;
      if (!data.refresh_token) {
        throw new Error("No refresh token in response. Try revoking app access and re-authorizing.");
      }

      await onToken(data.refresh_token);

      // Cache the access token we just got
      cachedAccessToken = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>Authorization successful!</h2><p>You can close this tab.</p></body></html>");
      new Notice("Google Drive authorized successfully!");
    } catch (e) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body><h2>Error</h2><p>${String(e)}</p></body></html>`);
      new Notice(`OAuth error: ${String(e)}`);
    } finally {
      server.close();
    }
  });

  server.listen(REDIRECT_PORT, "127.0.0.1", () => {
    // Use Electron shell to open the browser
    const { shell } = require("electron");
    shell.openExternal(authUrl.toString());
  });

  // Auto-close server after 2 minutes if no callback received
  setTimeout(() => {
    server.close();
  }, 120_000);
}
