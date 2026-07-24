import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export interface EmailFrameCopy {
	readonly brandName: string;
	readonly automatedMessage: string;
	readonly copyright: string;
}

interface EmailFrameProps {
	readonly children: ReactNode;
	readonly copy: EmailFrameCopy;
	readonly locale: string;
	readonly preview: string;
}

export function EmailFrame({ children, copy, locale, preview }: EmailFrameProps) {
	return (
		<Html lang={locale}>
			<Head />
			<Preview>{preview}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Section style={headerStyle}>
						<Heading as="h1" style={brandStyle}>
							{copy.brandName}
						</Heading>
					</Section>
					{children}
					<Section style={footerStyle}>
						<Hr style={dividerStyle} />
						<Text style={footerTextStyle}>{copy.automatedMessage}</Text>
						<Text style={footerTextStyle}>{copy.copyright}</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

const bodyStyle = {
	backgroundColor: "#f4f4f5",
	fontFamily: "Arial, Helvetica, sans-serif",
	margin: "0",
	padding: "24px 0",
} as const;

const containerStyle = {
	backgroundColor: "#ffffff",
	border: "1px solid #e4e4e7",
	borderRadius: "12px",
	margin: "0 auto",
	maxWidth: "560px",
	padding: "0 32px",
} as const;

const headerStyle = {
	padding: "32px 0 24px",
	textAlign: "center",
} as const;

const brandStyle = {
	color: "#18181b",
	fontSize: "22px",
	fontWeight: "700",
	letterSpacing: "-0.02em",
	margin: "0",
} as const;

const footerStyle = {
	padding: "8px 0 28px",
} as const;

const dividerStyle = {
	borderColor: "#e4e4e7",
	margin: "24px 0",
} as const;

const footerTextStyle = {
	color: "#71717a",
	fontSize: "12px",
	lineHeight: "18px",
	margin: "4px 0",
	textAlign: "center",
} as const;
