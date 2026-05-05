import { userMutations } from "@rezics/api/user/user.mutations";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
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
import React from "react";

import { Page } from "@/core/layouts/Page";
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";

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
      setError(err instanceof Error ? err.message : "Create failed"),
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
    <Page title="Create User" description="创建一个新用户（Admin）">
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/user" {...props}>
                  <ArrowBackIcon className="size-4" />
                  Back
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
                <Label htmlFor="ucp-email">Email</Label>
                <Input
                  id="ucp-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-password">Password</Label>
                <Input
                  id="ucp-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                />
                <p className="text-xs text-text-secondary">至少 6 位</p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-slug">Slug (username)</Label>
                <Input
                  id="ucp-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <p className="text-xs text-text-secondary">
                  5+ chars, letters/numbers, may include - _
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-avatar">Avatar URL</Label>
                <Input
                  id="ucp-avatar"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ucp-bio">Bio</Label>
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
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
              <p className="text-xs text-text-secondary">
                注意：这里是 Admin 创建用户，不需要验证码；后端会自动做 slug
                校验、email/slug 唯一性校验并哈希密码。
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}
