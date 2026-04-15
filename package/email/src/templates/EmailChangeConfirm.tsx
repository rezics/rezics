import { Button, Section, Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';

export interface EmailChangeConfirmProps {
  url: string;
  userName?: string;
  newEmail: string;
}

export function EmailChangeConfirm({
  url,
  userName,
  newEmail,
}: EmailChangeConfirmProps) {
  const greeting = userName || 'there';

  return (
    <EmailLayout preview="Confirm your email change">
      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hello {greeting},</Text>
        <Text style={bodyTextStyle}>
          A request was made to change your account email to{' '}
          <strong>{newEmail}</strong>. Click the button below to confirm this
          change:
        </Text>
        <Section style={buttonContainerStyle}>
          <Button href={url} style={buttonStyle}>
            Confirm Email Change
          </Button>
        </Section>
        <Text style={noteStyle}>
          If you did not request this change, you can safely ignore this email.
          Your email address will not be changed.
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

const buttonContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  margin: '0 0 24px',
};

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#111827',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 32px',
  borderRadius: '6px',
  textDecoration: 'none',
};

const noteStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  lineHeight: '1.5',
  margin: '0',
};
