import { Badge } from "@/shadcn/badge";
import { ExternalImageGuide } from "./ExternalImageGuide";
import type { ImageProvider } from "./types";

export const imgbbGuide: ImageProvider = {
  name: "imgbb",
  label: "ImgBB",
  icon: <Badge variant="outline">BB</Badge>,
  render: ({ onInsert }) => (
    <ExternalImageGuide
      name="ImgBB"
      url="https://imgbb.com"
      steps={[
        'Go to imgbb.com and click "Start Uploading"',
        "Select your image and upload it",
        'Copy the "Direct link" URL from the results',
        "Paste the URL below",
      ]}
      onInsert={onInsert}
    />
  ),
};
