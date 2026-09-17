/** Client-safe password policy text/regex (no native crypto deps). */
export const CREDENTIAL_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const CREDENTIAL_HINT =
  "At least 8 characters, with uppercase, lowercase, a number, and a special character.";
