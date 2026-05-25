import { echoKvGetQuery } from "@rezics/api/echokv/echokv";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { useMessage } from "@rezics/i18n/react";
import {
  book_edit_book_url,
  book_edit_create_book_by_url_description,
  book_edit_create_book_by_url_title,
  book_edit_supported_sites,
  common_create,
} from "@rezics/i18n/messages";
const i18nMessages = {
  book_edit_book_url,
  book_edit_create_book_by_url_description,
  book_edit_create_book_by_url_title,
  book_edit_supported_sites,
  common_create,
};

export function NewBookByUrl() {
  const m = useMessage(i18nMessages);
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
      <div className="text-2xl font-bold mb-4">
        {m.book_edit_create_book_by_url_title()}
      </div>
      <Alert>
        <AlertDescription>
          {m.book_edit_create_book_by_url_description()}
        </AlertDescription>
      </Alert>
      <div className="mt-4">
        <div>{m.book_edit_supported_sites()}</div>
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
            <Label htmlFor="new-book-url">{m.book_edit_book_url()}</Label>
            <Input
              id="new-book-url"
              value={url}
              onChange={(newValue) => setUrl(newValue.target.value)}
            />
          </div>
          <Button onClick={handleCreateBook}>{m.common_create()}</Button>
        </div>
      </div>
    </div>
  );
}
