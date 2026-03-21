export function validatePassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }

  if (password.length > 0 && !/[A-Z]/.test(password[0])) {
    errors.push("Password must start with a capital letter.");
  }

  if (
    password.length > 0 &&
    !/[!@#$%^&*(),.?":{}|<>]/.test(password[password.length - 1])
  ) {
    errors.push("Password must end with a special character.");
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
  };
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
