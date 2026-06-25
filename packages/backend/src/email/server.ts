export type { TemplateRegistryEntry } from "./registry";
export { templateRegistry } from "./registry";
export { render } from "./render";
export {
  type CreateEmailSenderOptions,
  createEmailSender,
  type EmailDeliveryFailure,
  type EmailDeliveryResult,
  type EmailMessage,
  type EmailSender,
  type EmailSenderIdentity,
  formatSenderAddress,
  type SmtpTransportConfig,
} from "./sender";
