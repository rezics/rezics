import { Badge } from "#/shadcn/badge";
import { ExternalImageGuide } from "./ExternalImageGuide";
import type { ImageProvider } from "./types";

export const imgboxGuide: ImageProvider = {
  name: "imgbox",
  label: "Imgbox",
  icon: <Badge variant="outline">IB</Badge>,
  render: ({ onInsert }) => (
    <ExternalImageGuide
      name="Imgbox"
      url="https://imgbox.com"
      steps={[
        "Go to imgbox.com",
        "Select your image and upload it",
        "Copy the direct image link",
        "Paste the URL below",
      ]}
      onInsert={onInsert}
    />
  ),
};
