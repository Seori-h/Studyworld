export interface AssetBinding { fetch(request: Request): Promise<Response> }

export interface Env {
  ASSETS: AssetBinding;
  UPSTREAM_ORIGIN: string;
  UPSTREAM_PUBLIC_KEY: string;
  UPSTREAM_SECRET_KEY: string;
  SESSION_KEY: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}
