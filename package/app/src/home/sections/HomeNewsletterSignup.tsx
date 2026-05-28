import { useTranslation } from "@rezics/i18n/react";
import { Button, Input } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

export const HomeNewsletterSignup: React.FC = () => {
  const { t } = useTranslation(["page"]);
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
        {t("page:home_sections_newsletter_title")}
      </p>
      {submitted ? (
        <p className="text-sm text-success-text m-0">
          {t("page:home_sections_newsletter_thanks")}
        </p>
      ) : (
        <form className="flex gap-2" onSubmit={onSubmit}>
          <Input
            type="email"
            required
            placeholder={t("page:home_sections_newsletter_email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
          <Button type="submit">
            {t("page:home_sections_newsletter_submit")}
          </Button>
        </form>
      )}
    </div>
  );
};

export default HomeNewsletterSignup;
