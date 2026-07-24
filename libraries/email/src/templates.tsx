import { Button, Heading, Link, Section, Text } from "@react-email/components";

import { EmailFrame, type EmailFrameCopy } from "./email-frame";

export interface ActionEmailCopy {
	readonly actionLabel: string;
	readonly body: string;
	readonly fallback: string;
	readonly heading: string;
	readonly ignoreNotice: string;
	readonly preview: string;
}

export interface ActionEmailTemplateProps {
	readonly actionUrl: string;
	readonly copy: ActionEmailCopy;
	readonly frame: EmailFrameCopy;
	readonly locale: string;
}

export function ActionEmailTemplate({ actionUrl, copy, frame, locale }: ActionEmailTemplateProps) {
	return (
		<EmailFrame copy={frame} locale={locale} preview={copy.preview}>
			<Section style={contentStyle}>
				<Heading as="h2" style={headingStyle}>
					{copy.heading}
				</Heading>
				<Text style={bodyTextStyle}>{copy.body}</Text>
				<Section style={buttonContainerStyle}>
					<Button href={actionUrl} style={buttonStyle}>
						{copy.actionLabel}
					</Button>
				</Section>
				<Text style={secondaryTextStyle}>{copy.fallback}</Text>
				<Text style={urlTextStyle}>
					<Link href={actionUrl} style={linkStyle}>
						{actionUrl}
					</Link>
				</Text>
				<Text style={secondaryTextStyle}>{copy.ignoreNotice}</Text>
			</Section>
		</EmailFrame>
	);
}

export interface NotificationEmailTemplateProps {
	readonly body: string;
	readonly frame: EmailFrameCopy;
	readonly locale: string;
	readonly subject: string;
}

export function NotificationEmailTemplate({
	body,
	frame,
	locale,
	subject,
}: NotificationEmailTemplateProps) {
	return (
		<EmailFrame copy={frame} locale={locale} preview={subject}>
			<Section style={contentStyle}>
				<Heading as="h2" style={headingStyle}>
					{subject}
				</Heading>
				<Text style={bodyTextStyle}>{body}</Text>
			</Section>
		</EmailFrame>
	);
}

const contentStyle = {
	padding: "0 0 16px",
} as const;

const headingStyle = {
	color: "#18181b",
	fontSize: "20px",
	fontWeight: "700",
	lineHeight: "28px",
	margin: "0 0 16px",
} as const;

const bodyTextStyle = {
	color: "#3f3f46",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 24px",
} as const;

const buttonContainerStyle = {
	margin: "0 0 24px",
	textAlign: "center",
} as const;

const buttonStyle = {
	backgroundColor: "#18181b",
	borderRadius: "8px",
	color: "#ffffff",
	fontSize: "14px",
	fontWeight: "600",
	padding: "12px 24px",
	textDecoration: "none",
} as const;

const secondaryTextStyle = {
	color: "#71717a",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "12px 0",
} as const;

const urlTextStyle = {
	fontSize: "12px",
	lineHeight: "18px",
	margin: "8px 0 16px",
	overflowWrap: "anywhere",
} as const;

const linkStyle = {
	color: "#3f3f46",
	textDecoration: "underline",
} as const;
