import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";

import type { EmailFrameCopy } from "./email-frame";
import { ActionEmailTemplate, type ActionEmailCopy, NotificationEmailTemplate } from "./templates";

export type { ActionEmailCopy, EmailFrameCopy };

export interface RenderedEmail {
	readonly html: string;
	readonly text: string;
}

export interface ActionEmailRenderInput {
	readonly actionUrl: string;
	readonly copy: ActionEmailCopy;
	readonly frame: EmailFrameCopy;
	readonly locale: string;
}

export interface NotificationEmailRenderInput {
	readonly body: string;
	readonly frame: EmailFrameCopy;
	readonly locale: string;
	readonly subject: string;
}

async function renderBoth(element: ReactElement): Promise<RenderedEmail> {
	const html = await render(element);
	return { html, text: toPlainText(html) };
}

export function renderActionEmail(input: ActionEmailRenderInput): Promise<RenderedEmail> {
	return renderBoth(<ActionEmailTemplate {...input} />);
}

export function renderNotificationEmail(
	input: NotificationEmailRenderInput,
): Promise<RenderedEmail> {
	return renderBoth(<NotificationEmailTemplate {...input} />);
}
