import { Button, Input } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const HomeNewsletterSignup: React.FC = () => {
  const { t } = useTranslation();
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
        {t("page.home.sections.newsletter.title")}
      </p>
      {submitted ? (
        <p className="text-sm text-rezics-color-success m-0">
          {t("page.home.sections.newsletter.thanks")}
        </p>
      ) : (
        <form className="flex gap-2" onSubmit={onSubmit}>
          <Input
            type="email"
            required
            placeholder={t("page.home.sections.newsletter.email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
          <Button type="submit">
            {t("page.home.sections.newsletter.submit")}
          </Button>
        </form>
      )}
    </div>
  );
};

export default HomeNewsletterSignup;
