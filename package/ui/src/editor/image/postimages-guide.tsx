import { Badge } from "#/shadcn/badge";
import { ExternalImageGuide } from "./ExternalImageGuide";
import type { ImageProvider } from "./types";

export const postimagesGuide: ImageProvider = {
  name: "postimages",
  label: "Postimages",
  icon: <Badge variant="outline">PI</Badge>,
  render: ({ onInsert }) => (
    <ExternalImageGuide
      name="Postimages"
      url="https://postimages.org"
      steps={[
        "Go to postimages.org",
        "Choose your image and upload it",
        'Copy the "Direct link" URL',
        "Paste the URL below",
      ]}
      onInsert={onInsert}
    />
  ),
};
