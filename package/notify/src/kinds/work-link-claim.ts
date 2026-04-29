import type { SupportedLocale } from "./locale";

export interface KindRender {
  systemBody: string;
  emailSubject: string;
  emailText: string;
}

interface PendingPayload {
  workTitle?: string;
  releaseSummary?: string;
}

interface ApprovedPayload {
  workTitle?: string;
}

interface RejectedPayload {
  workTitle?: string;
  rejectReason?: string;
}

const PENDING_TEMPLATES: Record<
  SupportedLocale,
  (p: PendingPayload) => KindRender
> = {
  en: ({ workTitle, releaseSummary }) => ({
    systemBody: `Someone wants to link a release${releaseSummary ? ` (${releaseSummary})` : ""} to your work${workTitle ? ` "${workTitle}"` : ""}.`,
    emailSubject: "New work-link claim awaiting review",
    emailText: `A new claim is waiting for review${workTitle ? ` on "${workTitle}"` : ""}. Visit your inbox to approve or reject it.`,
  }),
  "zh-hans": ({ workTitle, releaseSummary }) => ({
    systemBody: `有人请求将一个发行${releaseSummary ? `（${releaseSummary}）` : ""}关联到你的作品${workTitle ? `《${workTitle}》` : ""}。`,
    emailSubject: "有新的关联请求待审核",
    emailText: `${workTitle ? `《${workTitle}》` : "你的作品"}收到新的关联请求，请前往收件箱处理。`,
  }),
  "zh-hant": ({ workTitle, releaseSummary }) => ({
    systemBody: `有人請求將一個發行${releaseSummary ? `（${releaseSummary}）` : ""}關聯到你的作品${workTitle ? `《${workTitle}》` : ""}。`,
    emailSubject: "有新的關聯請求待審核",
    emailText: `${workTitle ? `《${workTitle}》` : "你的作品"}收到新的關聯請求，請前往收件匣處理。`,
  }),
  ja: ({ workTitle, releaseSummary }) => ({
    systemBody: `あなたの作品${workTitle ? `「${workTitle}」` : ""}にリリース${releaseSummary ? `（${releaseSummary}）` : ""}を紐づけるリクエストがあります。`,
    emailSubject: "新しいワークリンク申請があります",
    emailText: `${workTitle ? `「${workTitle}」` : "あなたの作品"}に新しいワークリンク申請があります。受信箱を確認してください。`,
  }),
  de: ({ workTitle, releaseSummary }) => ({
    systemBody: `Jemand möchte eine Veröffentlichung${releaseSummary ? ` (${releaseSummary})` : ""} mit deinem Werk${workTitle ? ` „${workTitle}“` : ""} verknüpfen.`,
    emailSubject: "Neue Werkverknüpfungsanfrage zur Prüfung",
    emailText: `Eine neue Anfrage wartet auf deine Prüfung${workTitle ? ` zu „${workTitle}“` : ""}. Bitte besuche deinen Posteingang.`,
  }),
};

const APPROVED_TEMPLATES: Record<
  SupportedLocale,
  (p: ApprovedPayload) => KindRender
> = {
  en: ({ workTitle }) => ({
    systemBody: `Your link request${workTitle ? ` to "${workTitle}"` : ""} was approved.`,
    emailSubject: "Your work-link claim was approved",
    emailText: `Good news — your link request${workTitle ? ` to "${workTitle}"` : ""} has been approved.`,
  }),
  "zh-hans": ({ workTitle }) => ({
    systemBody: `你的关联请求${workTitle ? `（${workTitle}）` : ""}已通过。`,
    emailSubject: "关联请求已通过",
    emailText: `好消息——你的关联请求${workTitle ? `（${workTitle}）` : ""}已通过审核。`,
  }),
  "zh-hant": ({ workTitle }) => ({
    systemBody: `你的關聯請求${workTitle ? `（${workTitle}）` : ""}已通過。`,
    emailSubject: "關聯請求已通過",
    emailText: `好消息——你的關聯請求${workTitle ? `（${workTitle}）` : ""}已通過審核。`,
  }),
  ja: ({ workTitle }) => ({
    systemBody: `あなたのワークリンク申請${workTitle ? `（${workTitle}）` : ""}が承認されました。`,
    emailSubject: "ワークリンク申請が承認されました",
    emailText: `あなたのワークリンク申請${workTitle ? `（${workTitle}）` : ""}が承認されました。`,
  }),
  de: ({ workTitle }) => ({
    systemBody: `Deine Verknüpfungsanfrage${workTitle ? ` zu „${workTitle}“` : ""} wurde genehmigt.`,
    emailSubject: "Werkverknüpfungsanfrage genehmigt",
    emailText: `Gute Nachricht — deine Anfrage${workTitle ? ` zu „${workTitle}“` : ""} wurde genehmigt.`,
  }),
};

const REJECTED_TEMPLATES: Record<
  SupportedLocale,
  (p: RejectedPayload) => KindRender
> = {
  en: ({ workTitle, rejectReason }) => ({
    systemBody: `Your link request${workTitle ? ` to "${workTitle}"` : ""} was rejected${rejectReason ? `: ${rejectReason}` : ""}.`,
    emailSubject: "Your work-link claim was rejected",
    emailText: `Your link request${workTitle ? ` to "${workTitle}"` : ""} was rejected${rejectReason ? `. Reason: ${rejectReason}` : ""}.`,
  }),
  "zh-hans": ({ workTitle, rejectReason }) => ({
    systemBody: `你的关联请求${workTitle ? `（${workTitle}）` : ""}被拒绝${rejectReason ? `：${rejectReason}` : ""}。`,
    emailSubject: "关联请求未通过",
    emailText: `你的关联请求${workTitle ? `（${workTitle}）` : ""}未通过${rejectReason ? `。原因：${rejectReason}` : ""}。`,
  }),
  "zh-hant": ({ workTitle, rejectReason }) => ({
    systemBody: `你的關聯請求${workTitle ? `（${workTitle}）` : ""}被拒絕${rejectReason ? `：${rejectReason}` : ""}。`,
    emailSubject: "關聯請求未通過",
    emailText: `你的關聯請求${workTitle ? `（${workTitle}）` : ""}未通過${rejectReason ? `。原因：${rejectReason}` : ""}。`,
  }),
  ja: ({ workTitle, rejectReason }) => ({
    systemBody: `あなたのワークリンク申請${workTitle ? `（${workTitle}）` : ""}は却下されました${rejectReason ? `：${rejectReason}` : ""}。`,
    emailSubject: "ワークリンク申請が却下されました",
    emailText: `あなたのワークリンク申請${workTitle ? `（${workTitle}）` : ""}は却下されました${rejectReason ? `。理由：${rejectReason}` : ""}。`,
  }),
  de: ({ workTitle, rejectReason }) => ({
    systemBody: `Deine Verknüpfungsanfrage${workTitle ? ` zu „${workTitle}“` : ""} wurde abgelehnt${rejectReason ? `: ${rejectReason}` : ""}.`,
    emailSubject: "Werkverknüpfungsanfrage abgelehnt",
    emailText: `Deine Anfrage${workTitle ? ` zu „${workTitle}“` : ""} wurde abgelehnt${rejectReason ? `. Grund: ${rejectReason}` : ""}.`,
  }),
};

export function renderPending(
  locale: SupportedLocale,
  payload: PendingPayload,
): KindRender {
  return PENDING_TEMPLATES[locale](payload);
}

export function renderApproved(
  locale: SupportedLocale,
  payload: ApprovedPayload,
): KindRender {
  return APPROVED_TEMPLATES[locale](payload);
}

export function renderRejected(
  locale: SupportedLocale,
  payload: RejectedPayload,
): KindRender {
  return REJECTED_TEMPLATES[locale](payload);
}
