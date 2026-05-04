import { userMutations } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";

import { Spinner } from "@rezics/ui";
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
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/user/$unitId";
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon } from "lucide-react";

export default function UserEditPage() {
  const { unitId } = Route.useParams();
  const [error, setError] = React.useState<string | null>(null);

  const detailQuery = useQuery(userQueries.adminDetail(unitId));

  const updateMutation = userMutations.useAdminUpdate({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Update failed"),
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
    setDescription(u.description ?? "");
    setPassword("");
  }, [detailQuery.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await updateMutation.mutateAsync({
      unitId,
      input: {
        name: name.trim() || undefined,
        avatar: avatar.trim() || undefined,
        bio: bio.trim() || undefined,
        description: description.trim() || undefined,
        password: password.length ? password : undefined,
      } as any,
    });
    setPassword("");
    await detailQuery.refetch();
  }

  return (
    <Page title="Edit User" description={`编辑用户：${unitId}`}>
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/user">
                <ArrowBackIcon className="size-4" />
                Back
              </Link>
            </Button>
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
                Failed to load user.
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
                Email: <strong>{detailQuery.data?.email ?? "-"}</strong>
              </p>

              <form onSubmit={onSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-name">Name</Label>
                    <Input
                      id="uep-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-avatar">Avatar URL</Label>
                    <Input
                      id="uep-avatar"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-bio">Bio</Label>
                    <textarea
                      id="uep-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={2}
                      className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-description">Description</Label>
                    <textarea
                      id="uep-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-password">New Password</Label>
                    <Input
                      id="uep-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                    />
                    <p className="text-xs text-text-secondary">
                      留空表示不修改密码
                    </p>
                  </div>

                  <div>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      <SaveIcon className="size-4" />
                      {updateMutation.isPending ? "Saving…" : "Save"}
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
