import { Button, Input } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  page_home_sections_newsletter_email_placeholder,
  page_home_sections_newsletter_submit,
  page_home_sections_newsletter_thanks,
  page_home_sections_newsletter_title,
} from "@rezics/i18n/messages";
const m = {
  page_home_sections_newsletter_email_placeholder,
  page_home_sections_newsletter_submit,
  page_home_sections_newsletter_thanks,
  page_home_sections_newsletter_title,
};

const i18nMessages = {
  page_home_sections_newsletter_email_placeholder,
  page_home_sections_newsletter_submit,
  page_home_sections_newsletter_thanks,
  page_home_sections_newsletter_title,
};

export const HomeNewsletterSignup: React.FC = () => {
  const m = useMessage(i18nMessages);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder: integrate backend later
    console.log("newsletter signup", email);
    setSubmitted(true);
  };

  return (
    <div className="w-full rounded border p-4 bg-white">
      <p className="text-base font-medium mb-2">
        {m.page_home_sections_newsletter_title()}
      </p>
      {submitted ? (
        <p className="text-sm text-success-text m-0">
          {m.page_home_sections_newsletter_thanks()}
        </p>
      ) : (
        <form className="flex gap-2" onSubmit={onSubmit}>
          <Input
            type="email"
            required
            placeholder={m.page_home_sections_newsletter_email_placeholder()}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
          <Button type="submit">
            {m.page_home_sections_newsletter_submit()}
          </Button>
        </form>
      )}
    </div>
  );
};

export default HomeNewsletterSignup;
