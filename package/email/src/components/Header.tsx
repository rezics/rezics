import { Heading, Img, Row, Column, Section } from '@react-email/components';

const LOGO_URL = 'https://rezics.com/logo.svg';

export function Header() {
  return (
    <Section style={headerStyle}>
      <Row>
        <Column align="center">
          <Img
            src={LOGO_URL}
            alt="REZICS"
            width={32}
            height={32}
            style={logoStyle}
          />
          <Heading as="h1" style={titleStyle}>
            REZICS
          </Heading>
        </Column>
      </Row>
    </Section>
  );
}

const headerStyle: React.CSSProperties = {
  padding: '32px 0 24px',
  textAlign: 'center',
};

const logoStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: '8px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#111827',
  margin: '0',
  letterSpacing: '-0.025em',
};
