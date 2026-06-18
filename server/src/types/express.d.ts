declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      validatedQuery?: unknown;
    }
  }
}

export {};
