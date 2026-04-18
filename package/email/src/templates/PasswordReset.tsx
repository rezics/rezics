import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";

export interface PasswordResetProps {
  url: string;
  userName?: string;
}

export function PasswordReset({ url, userName }: PasswordResetProps) {
  const greeting = userName || "there";

  return (
    <EmailLayout preview="Reset your password">
      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hello {greeting},</Text>
        <Text style={bodyTextStyle}>
          We received a request to reset your password. Click the button below
          to choose a new password:
        </Text>
        <Section style={buttonContainerStyle}>
          <Button href={url} style={buttonStyle}>
            Reset Password
          </Button>
        </Section>
        <Text style={expiryStyle}>
          This link will expire shortly. If you did not request a password
          reset, you can safely ignore this email.
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

const expiryStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  lineHeight: "1.5",
  margin: "0",
};
