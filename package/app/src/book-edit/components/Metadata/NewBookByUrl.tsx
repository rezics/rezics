import { echoKvGetQuery } from "@rezics/api/echokv/echokv";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function NewBookByUrl() {
  const [url, setUrl] = useState("");
  function handleCreateBook() {
    // TODO 对接爬虫
    console.log("create book", url);
  }
  const supportedSitesQuery = useQuery(
    echoKvGetQuery("crawler.supportedSites"),
  );
  const [supportedSitesList, setSupportedSitesList] = useState<
    { name: string; url: string }[]
  >([]);
  useEffect(() => {
    if (
      supportedSitesQuery.data?.value &&
      Array.isArray(supportedSitesQuery.data.value)
    ) {
      setSupportedSitesList(supportedSitesQuery.data.value);
    }
  }, [supportedSitesQuery]);
  return (
    <div className="mt-16 mx-auto w-11/12">
      <div className="text-2xl font-bold mb-4">通过URL创建书籍</div>
      <Alert>
        <AlertDescription>
          请输入书籍的URL，系统将自动获取书籍的元数据，并创建书籍。
        </AlertDescription>
      </Alert>
      <div className="mt-4">
        <div>支持的网站：</div>
        <ul>
          {supportedSitesList.map((site) => (
            <li key={site.name}>
              <SafeLink href={site.url}>
                {site.name}: {site.url}
              </SafeLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-12">
        <div className="flex mb-4 items-end gap-4">
          <div className="flex-1 flex flex-col gap-1">
            <Label htmlFor="new-book-url">书籍URL</Label>
            <Input
              id="new-book-url"
              value={url}
              onChange={(newValue) => setUrl(newValue.target.value)}
            />
          </div>
          <Button onClick={handleCreateBook}>创建</Button>
        </div>
      </div>
    </div>
  );
}
