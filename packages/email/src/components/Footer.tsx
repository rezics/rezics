/** @jsxImportSource react */
import { Hr, Link, Section, Text } from "@react-email/components";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <Section style={footerStyle}>
      <Hr style={dividerStyle} />
      <Text style={copyrightStyle}>
        &copy; {year} REZICS. All rights reserved.
      </Text>
      <Text style={explanationStyle}>
        This is an automated message from REZICS. Please do not reply directly
        to this email.
      </Text>
      <Text style={linksStyle}>
        <Link href="https://rezics.com" style={linkStyle}>
          Website
        </Link>
        {" · "}
        <Link href="https://rezics.com/privacy" style={linkStyle}>
          Privacy
        </Link>
        {" · "}
        <Link href="https://rezics.com/terms" style={linkStyle}>
          Terms
        </Link>
      </Text>
    </Section>
  );
}

const footerStyle: React.CSSProperties = {
  padding: "0 0 32px",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const copyrightStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  textAlign: "center",
  margin: "0 0 4px",
};

const explanationStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  textAlign: "center",
  margin: "0 0 8px",
};

const linksStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  textAlign: "center",
  margin: "0",
};

const linkStyle: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
};
