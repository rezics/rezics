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
