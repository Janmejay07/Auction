// Augment Express Request with userId added by the authenticate middleware.
// Having this in a .d.ts file ensures every file in the project sees it
// without any explicit import.
declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware on protected routes. */
      userId?: string;
      user?: {
        id: string;
        userId: string;
      };
    }
  }
}

export {};
