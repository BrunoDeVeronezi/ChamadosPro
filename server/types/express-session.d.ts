import "express-session";

declare module "express-session" {
  interface SessionData {
    codeVerifier?: string;
    state?: string;
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      picture?: string;
    };
  }
}
