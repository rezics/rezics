import { useTranslation } from "@rezics/i18n/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Separator,
} from "@rezics/ui/shadcn";
import { ArrowLeft as ArrowBackIcon } from "lucide-react";
import { Page } from "@/admin/core/layouts/Page";
import { Link } from "@/admin/shared/ui/link";

export default function UserCreatePage() {
  const { t } = useTranslation(["admin", "common"]);

  return (
    <Page
      title={t("admin:user_create_title")}
      description={t("admin:placeholder_coming_soon_description")}
    >
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/user" {...props}>
                  <ArrowBackIcon className="size-4" />
                  {t("common:back")}
                </Link>
              )}
            />
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          <Alert>
            <AlertTitle>{t("admin:placeholder_coming_soon_title")}</AlertTitle>
            <AlertDescription>
              {t("admin:placeholder_coming_soon_description")}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </Page>
  );
}
