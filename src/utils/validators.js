const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  const value = (email || "").trim();
  if (!value) {
    return { valid: false, message: "Email is required." };
  }
  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, message: "Please enter a valid email address." };
  }
  return { valid: true, message: "" };
}

/**
 * Strong password policy, aligned with common modern login systems:
 * - at least 8 characters
 * - at least one uppercase letter
 * - at least one lowercase letter
 * - at least one number
 * - at least one special character
 */
export const PASSWORD_MIN_LENGTH = 8;

export function getPasswordChecks(password) {
  const value = password || "";
  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    hasUpperCase: /[A-Z]/.test(value),
    hasLowerCase: /[a-z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSpecialChar: /[^A-Za-z0-9]/.test(value),
  };
}

export function getPasswordStrength(password) {
  const checks = getPasswordChecks(password);
  const passedCount = Object.values(checks).filter(Boolean).length;

  if (!password) return { score: 0, label: "" };
  if (passedCount <= 2) return { score: 1, label: "Weak" };
  if (passedCount <= 4) return { score: 2, label: "Medium" };
  return { score: 3, label: "Strong" };
}

export function validatePassword(password) {
  const checks = getPasswordChecks(password);

  if (!password) {
    return { valid: false, message: "Password is required." };
  }
  if (!checks.minLength) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    };
  }
  if (!checks.hasUpperCase) {
    return { valid: false, message: "Password must include at least one uppercase letter." };
  }
  if (!checks.hasLowerCase) {
    return { valid: false, message: "Password must include at least one lowercase letter." };
  }
  if (!checks.hasNumber) {
    return { valid: false, message: "Password must include at least one number." };
  }
  if (!checks.hasSpecialChar) {
    return {
      valid: false,
      message: "Password must include at least one special character (e.g. !@#$%).",
    };
  }
  return { valid: true, message: "" };
}

export function validateName(name) {
  const value = (name || "").trim();
  if (!value) {
    return { valid: false, message: "Name is required." };
  }
  if (value.length < 2) {
    return { valid: false, message: "Name must be at least 2 characters long." };
  }
  return { valid: true, message: "" };
}

export function validateOtpCode(code, length = 6) {
  const value = (code || "").trim();
  if (!value) {
    return { valid: false, message: `Please enter the ${length}-digit code.` };
  }
  if (!new RegExp(`^\\d{${length}}$`).test(value)) {
    return { valid: false, message: `The code must be exactly ${length} digits.` };
  }
  return { valid: true, message: "" };
}
