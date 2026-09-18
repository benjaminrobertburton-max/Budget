// Messages are deliberately static: never include page content, amounts, or credentials.
export class CollectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CollectionError";
    this.code = code;
  }
}

export function requireEvidence(condition, code, message) {
  if (!condition) throw new CollectionError(code, message);
}

export function safeIssue(accountId, error) {
  return {
    accountId,
    code: error instanceof CollectionError ? error.code : "ADAPTER_ERROR",
    message: error instanceof CollectionError
      ? error.message
      : "Collection failed. Private source details have not been included in this message.",
  };
}
