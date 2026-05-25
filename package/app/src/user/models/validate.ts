import {
  auth_error_email_required,
  auth_error_invalid_email,
  auth_error_name_min_length,
  auth_error_name_required,
  auth_error_password_letter_required,
  auth_error_password_min_length,
  auth_error_password_number_required,
  auth_error_password_required,
} from "@rezics/i18n/messages";

export function validateEmail(email: string) {
  if (!email) {
    return { valid: false, error: auth_error_email_required() };
  }
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) {
    return { valid: false, error: auth_error_invalid_email() };
  }
  return { valid: true, error: null };
}

export function validatePassword(password: string) {
  if (!password) {
    return { valid: false, error: auth_error_password_required() };
  }
  if (password.length < 8) {
    return {
      valid: false,
      error: auth_error_password_min_length(),
    };
  }
  // if (!/[A-Z]/.test(password)) {
  //   return {
  //     valid: false,
  //     error: 'Password must contain at least one uppercase letter.',
  //   };
  // }
  if (!/[A-Za-z]/.test(password)) {
    return {
      valid: false,
      error: auth_error_password_letter_required(),
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: auth_error_password_number_required(),
    };
  }
  // if (!/[^A-Za-z0-9]/.test(password)) {
  //   return {
  //     valid: false,
  //     error: 'Password must contain at least one special character.',
  //   };
  // }
  return { valid: true, error: null };
}

export function validateName(name: string) {
  if (!name) {
    return { valid: false, error: auth_error_name_required() };
  }
  if (name.length < 5) {
    return { valid: false, error: auth_error_name_min_length() };
  }
  // if (!/^[A-Za-z0-9_\-\s]+$/.test(name)) {
  //   return {
  //     valid: false,
  //     error:
  //       'Name can only contain letters, numbers, spaces, underscores, or hyphens.',
  //   };
  // }
  return { valid: true, error: null };
}

export function validateSlug(slug: string) {
  if (!slug) {
    return { valid: false, error: "Slug is required." };
  }
  if (slug.length < 6) {
    return { valid: false, error: "Slug must be at least 6 characters long." };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    return {
      valid: false,
      error:
        "Slug can only contain lowercase letters, uppercase letters, numbers, and hyphens.",
    };
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { valid: false, error: "Slug cannot start or end with a hyphen." };
  }
  if (slug.includes("--")) {
    return { valid: false, error: "Slug cannot contain consecutive hyphens." };
  }
  return { valid: true, error: null };
}
