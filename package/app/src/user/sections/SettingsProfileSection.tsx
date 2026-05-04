import { useUpdateMeMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UpdateUser } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Save as SaveIcon } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

export const SettingsProfileSection: FC = () => {
  useRequireAuth();

  const { data: user, isLoading } = useQuery(userQueries.me());
  const [formData, setFormData] = useState<UpdateUser>({
    name: "",
    avatar: "",
    bio: "",
    description: "",
  });
  const [success, setSuccess] = useState(false);

  const updateMe = useUpdateMeMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name ?? "",
        avatar: user.avatar ?? "",
        bio: user.bio ?? "",
        description: user.description ?? "",
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const handleChange = (field: keyof UpdateUser, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe.mutate({
      name: formData.name || undefined,
      avatar: formData.avatar || undefined,
      bio: formData.bio || undefined,
      description: formData.description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SettingsSection
        title="Public Profile"
        description="This information will be displayed publicly on your profile page."
      >
        {success && (
          <Alert className="mb-4 text-success-text">
            <AlertDescription>Profile updated successfully.</AlertDescription>
          </Alert>
        )}
        {updateMe.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{updateMe.error.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-[72px] h-[72px] rounded-md">
            <AvatarImage src={formData.avatar} alt={formData.name ?? ""} />
            <AvatarFallback>
              {formData.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="avatar-url">Avatar URL</Label>
            <Input
              id="avatar-url"
              value={formData.avatar}
              onChange={(e) => handleChange("avatar", e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          {user?.slug && (
            <div>
              <p className="text-xs text-text-secondary">Username</p>
              <p className="text-sm mt-1">@{user.slug}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              rows={2}
              placeholder="A short bio about yourself"
              className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
            />
          </div>

          <div>
            <p className="text-xs text-text-secondary mb-2 block">
              Description
            </p>
            <RezicsMarkdownEditor
              value={formData.description ?? ""}
              onChange={(value) => handleChange("description", value)}
            />
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end py-4">
        <Button type="submit" disabled={updateMe.isPending}>
          {updateMe.isPending ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <SaveIcon className="w-4 h-4 mr-2" />
          )}
          Save Profile
        </Button>
      </div>
    </form>
  );
};
