import { CookieConsentBanner } from "@rezics/ui/composite/cookie-consent/CookieConsentBanner.tsx";

export function TestPage03() {
  const _bookurl = "/book/019c3be6-2ffb-7cf0-b4eb-ecbd57c25f18";
  return (
    <div className="h-[500px] w-[500px] bg-black flex items-center justify-center">
      <CookieConsentBanner
        title="Cookies on Rezics"
        body="We use cookies to keep you signed in."
        policyLabel="Review policy"
        acceptLabel="Allow cookies"
        onAccept={() => {}}
        onPolicyClick={() => {}}
      />
      <img src="https://www.qidian.com/favicon.ico" alt="logo" />
      {/* <MUILink to={bookurl}>Home</MUILink> */}
    </div>
  );
}
