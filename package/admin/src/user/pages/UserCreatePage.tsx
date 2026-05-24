import { userMutations } from "@rezics/api/user/user.mutations";
import * as m from "@rezics/i18n/messages";
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
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";
import React from "react";

import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

export default function UserCreatePage() {
  const navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [avatar, setAvatar] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = userMutations.useAdminCreate({
    onError: (err: unknown) =>
      setError(
        err instanceof Error ? err.message : m.admin_user_create_failed(),
      ),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const user = await createMutation.mutateAsync({
      email: email.trim(),
      password,
      slug: slug.trim(),
      avatar: avatar.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    await navigate({ to: `/user/${user.unitId}`, replace: true });
  }

  return (
    <Page
      title={m.admin_user_create_title()}
      description={m.admin_user_create_description()}
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

          {error ? (
            <Alert className="mb-4">
              <AlertDescription className="text-error-text">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-email">
                  {m.admin_user_rezics_email_label()}
                </Label>
                <Input
                  id="ucp-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-password">{m.common_password()}</Label>
                <Input
                  id="ucp-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                />
                <p className="text-xs text-text-secondary">
                  {m.admin_user_password_min_help()}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-slug">{m.admin_user_slug_label()}</Label>
                <Input
                  id="ucp-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <p className="text-xs text-text-secondary">
                  {m.admin_user_slug_help()}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-avatar">
                  {m.admin_user_avatar_url_label()}
                </Label>
                <Input
                  id="ucp-avatar"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-bio">{m.admin_user_bio_label()}</Label>
                <textarea
                  id="ucp-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                />
              </div>

              <div>
                <Button type="submit" disabled={createMutation.isPending}>
                  <SaveIcon className="size-4" />
                  {createMutation.isPending
                    ? m.admin_user_creating()
                    : m.common_create()}
                </Button>
              </div>
              <p className="text-xs text-text-secondary">
                {m.admin_user_create_note()}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}
