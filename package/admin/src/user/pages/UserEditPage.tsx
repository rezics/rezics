import * as m from "@rezics/i18n/messages";
import {
  contentDocMarkdownFallback,
  markdownContentDoc,
} from "@rezics/contract";
import { userMutations } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";

import { Spinner } from "@rezics/ui";
import { Link } from "@/shared/ui/link";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/user/$userId";
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";

export default function UserEditPage() {
  const { userId } = Route.useParams();
  const [error, setError] = React.useState<string | null>(null);

  const detailQuery = useQuery(userQueries.adminDetail(userId));

  const updateMutation = userMutations.useAdminUpdate({
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : m.admin_user_update_failed(),
      ),
    onSuccess: () => setError(null),
  });

  const [name, setName] = React.useState("");
  const [avatar, setAvatar] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    const u = detailQuery.data;
    if (!u) return;
    setName(u.name ?? "");
    setAvatar(u.avatar ?? "");
    setBio(u.bio ?? "");
    setDescription(contentDocMarkdownFallback(u.description));
    setPassword("");
  }, [detailQuery.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await updateMutation.mutateAsync({
      userId,
      input: {
        name: name.trim() || undefined,
        avatar: avatar.trim() || undefined,
        bio: bio.trim() || undefined,
        description: description.trim()
          ? markdownContentDoc(description.trim())
          : undefined,
        password: password.length ? password : undefined,
      } as any,
    });
    setPassword("");
    await detailQuery.refetch();
  }

  return (
    <Page
      title={m.admin_user_edit_title()}
      description={m.admin_user_edit_description({ userId })}
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
                  {m.common_back()}
                </Link>
              )}
            />
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          {detailQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : detailQuery.isError ? (
            <Alert>
              <AlertDescription className="text-error-text">
                {m.admin_user_failed_to_load()}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {error ? (
                <Alert className="mb-4">
                  <AlertDescription className="text-error-text">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}

              <p className="text-sm text-text-secondary mb-4">
                {m.admin_user_email_display()}{" "}
                <strong>{detailQuery.data?.email ?? "-"}</strong>
              </p>

              <form onSubmit={onSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-name">
                      {m.admin_user_name_label()}
                    </Label>
                    <Input
                      id="uep-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-avatar">
                      {m.admin_user_avatar_url_label()}
                    </Label>
                    <Input
                      id="uep-avatar"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-bio">{m.admin_user_bio_label()}</Label>
                    <textarea
                      id="uep-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={2}
                      className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-description">
                      {m.admin_user_description_label()}
                    </Label>
                    <textarea
                      id="uep-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-password">
                      {m.admin_user_new_password_label()}
                    </Label>
                    <Input
                      id="uep-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                    />
                    <p className="text-xs text-text-secondary">
                      {m.admin_user_keep_password_help()}
                    </p>
                  </div>

                  <div>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      <SaveIcon className="size-4" />
                      {updateMutation.isPending
                        ? m.common_saving()
                        : m.common_save()}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
