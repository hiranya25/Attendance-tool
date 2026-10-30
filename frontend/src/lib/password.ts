// Same rule as the server (server/src/api/auth.ts). The server always checks again.
export const PASSWORD_RULE = 'Use at least 8 characters, including at least one number.';

export function passwordProblem(p: string): string | null {
  return p.length < 8 || !/\d/.test(p) ? PASSWORD_RULE : null;
}
