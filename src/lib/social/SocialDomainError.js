export class SocialDomainError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "SocialDomainError";
    this.code = code;
    this.details = details;
  }
}

export function isSocialDomainError(error, code = null) {
  return error instanceof SocialDomainError && (code == null || error.code === code);
}

