export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;

  if ("errors" in error && Array.isArray(error.errors)) {
    const first = error.errors[0] as { longMessage?: unknown; message?: unknown } | undefined;
    if (typeof first?.longMessage === "string") return first.longMessage;
    if (typeof first?.message === "string") return first.message;
  }

  if ("longMessage" in error && typeof error.longMessage === "string") return error.longMessage;
  return fallback;
}

