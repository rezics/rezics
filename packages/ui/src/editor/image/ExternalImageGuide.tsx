import { useState } from "react";
import { SafeLink } from "#/link/SafeLink";
import { Button } from "#/shadcn/button";
import { Input } from "#/shadcn/input";

export interface ExternalImageGuideConfig {
  name: string;
  url: string;
  steps: string[];
}

interface ExternalImageGuideProps extends ExternalImageGuideConfig {
  onInsert: (url: string, alt?: string) => void;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ExternalImageGuide({
  name,
  url,
  steps,
  onInsert,
}: ExternalImageGuideProps) {
  const [imageUrl, setImageUrl] = useState("");
  const valid = isValidUrl(imageUrl);

  const handleSubmit = () => {
    if (valid) {
      onInsert(imageUrl);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-1">
      <p className="text-sm font-medium">
        Upload your image to{" "}
        <SafeLink href={url} className="text-link underline">
          {name}
        </SafeLink>
        , then paste the direct image URL below.
      </p>
      <ol className="pl-5 m-0 list-decimal text-sm text-rezics-fg-muted [&_li]:mb-1">
        {steps.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Input
          placeholder="https://..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleSubmit}
          disabled={!valid}
        >
          Insert
        </Button>
      </div>
    </div>
  );
}
