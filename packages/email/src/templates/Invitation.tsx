import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";

export interface InvitationProps {
  inviterName: string;
  orgName: string;
  url: string;
}

export function Invitation({ inviterName, orgName, url }: InvitationProps) {
  return (
    <EmailLayout preview={`${inviterName} invited you to join ${orgName}`}>
      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hello,</Text>
        <Text style={bodyTextStyle}>
          <strong>{inviterName}</strong> has invited you to join{" "}
          <strong>{orgName}</strong> on REZICS.
        </Text>
        <Section style={buttonContainerStyle}>
          <Button href={url} style={buttonStyle}>
            Accept Invitation
          </Button>
        </Section>
        <Text style={noteStyle}>
          If you did not expect this invitation, you can safely ignore this
          email.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const contentStyle: React.CSSProperties = {
  padding: "0 0 24px",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#111827",
  margin: "0 0 12px",
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "1.6",
  margin: "0 0 24px",
};

const buttonContainerStyle: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 24px",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 32px",
  borderRadius: "6px",
  textDecoration: "none",
};

const noteStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  lineHeight: "1.5",
  margin: "0",
};
