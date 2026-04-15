import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface VerificationCodeProps {
  code: string;
  userName?: string;
}

export function VerificationCode({ code, userName }: VerificationCodeProps) {
  const greeting = userName || 'there';

  return (
    <EmailLayout preview={`Your verification code is ${code}`}>
      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hello {greeting},</Text>
        <Text style={bodyTextStyle}>
          Enter the following code in the app to verify your email address:
        </Text>
        <Section style={codeContainerStyle}>
          <Text style={codeStyle}>{code}</Text>
        </Section>
        <Text style={expiryStyle}>
          This code expires in 5 minutes. If you did not request this, you can
          safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const contentStyle: React.CSSProperties = {
  padding: '0 0 24px',
};

const greetingStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#111827',
  margin: '0 0 12px',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 24px',
};

const codeContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 0',
  margin: '0 0 24px',
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
};

const codeStyle: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: 700,
  fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
  letterSpacing: '0.3em',
  color: '#111827',
  margin: '0',
};

const expiryStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  lineHeight: '1.5',
  margin: '0',
};
