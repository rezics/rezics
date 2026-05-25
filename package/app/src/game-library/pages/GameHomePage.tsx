import { useMessage } from "@rezics/i18n/react";
import { game_library_title } from "@rezics/i18n/messages";
const m = {
  game_library_title,
};

const i18nMessages = {
  game_library_title,
};

export const GameHomePage: React.FC = () => {
  const m = useMessage(i18nMessages);
  return <div>{m.game_library_title()}</div>;
};
