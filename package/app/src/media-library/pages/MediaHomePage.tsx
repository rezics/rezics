import { useMessage } from "@rezics/i18n/react";
import { media_library_title } from "@rezics/i18n/messages";
const i18nMessages = {
  media_library_title,
};

export const MediaHomePage: React.FC = () => {
  const m = useMessage(i18nMessages);
  return <div>{m.media_library_title()}</div>;
};
