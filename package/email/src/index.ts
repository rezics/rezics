export { EmailLayout } from "./components/EmailLayout";
export { Footer } from "./components/Footer";
export { Header } from "./components/Header";
export type { TemplateRegistryEntry } from "./registry";
export { templateRegistry } from "./registry";
export { render } from "./render";
export {
  createEmailSender,
  formatSenderAddress,
  type CreateEmailSenderOptions,
  type EmailDeliveryFailure,
  type EmailDeliveryResult,
  type EmailMessage,
  type EmailSender,
  type EmailSenderIdentity,
  type SmtpTransportConfig,
} from "./sender";
export { EmailChangeConfirm } from "./templates/EmailChangeConfirm";
export { Invitation } from "./templates/Invitation";
export { PasswordReset } from "./templates/PasswordReset";
export { VerificationCode } from "./templates/VerificationCode";
