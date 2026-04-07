import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import {
  GreenButton,
  OrangeButton,
  RoseButton,
} from "@rezics/ui/primitive/button/colorful/index.ts";
import { ShadowRoundedCard } from "@rezics/ui/primitive/card/Card.tsx";
import { RoseTextField } from "@rezics/ui/primitive/control/text-input/TextField.tsx";
import { useEffect, useState } from "react";
import { useUserProfileStore } from "@/user/state";

interface UserConfig {
  name: string;
  email: string;
  bio: string;
  privateKey: string;
}

function fetchUserConfig(userId: string): Promise<UserConfig> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        name: `User ${userId}`,
        email: `user${userId}@example.com`,
        bio: "This is a short bio for configuration.",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----",
      });
    }, 800);
  });
}

export function CustomTopbar({
  section,
  setSection,
}: {
  section: string;
  setSection: (section: "Profile" | "Security") => void;
}) {
  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        px: 3,
      }}
      className="rounded-3xl"
    >
      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        textColor="primary"
        indicatorColor="primary"
        aria-label="settings tabs"
      >
        <Tab
          value="Profile"
          label="Profile Settings"
          icon={<span style={{ fontSize: 18 }}>👤</span>}
          iconPosition="start"
        />
        <Tab
          value="Security"
          label="Security & Privacy"
          icon={<span style={{ fontSize: 18 }}>🔒</span>}
          iconPosition="start"
        />
      </Tabs>
    </Box>
  );
}

export function MainConfigPage() {
  const user = useUserProfileStore((state) => state.user);
  const userId = user?.id as string;
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"Profile" | "Security">("Profile");
  const [passwords, setPasswords] = useState({
    oldPwd: "",
    newPwd: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserConfig(userId!).then((data) => {
      setConfig(data);
      setLoading(false);
    });
  }, [userId]);

  const handleProfileSave = () => {
    if (!config) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert("Profile saved");
    }, 800);
  };

  const handlePasswordSave = () => {
    if (passwords.newPwd !== passwords.confirm) {
      alert("New passwords do not match");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert("Password updated");
      setPasswords({ oldPwd: "", newPwd: "", confirm: "" });
    }, 800);
  };

  const handleRegenerateKey = () => {
    setSaving(true);
    setTimeout(() => {
      setConfig(
        (prev) =>
          prev && {
            ...prev,
            privateKey:
              "-----BEGIN PRIVATE KEY-----\nNEWKEY123456...\n-----END PRIVATE KEY-----",
          },
      );
      setSaving(false);
      alert("Private key regenerated");
    }, 800);
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <div className="flex flex-col items-center space-y-4">
          <CircularProgress size={48} className="text-rose-500" />
          <Typography variant="body1" className="text-gray-600 font-medium">
            Loading settings...
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
      <div className="flex-col max-w-7xl mx-auto">
        <div className="pt-4" />
        <CustomTopbar section={section} setSection={setSection} />
        {/* 主内容区 */}
        <div className="flex-1 p-12">
          <div className="max-w-4xl">
            <div className="mb-12">
              <Typography variant="h3" className="font-bold text-gray-900 mb-3">
                {section} Settings
              </Typography>
              <Typography variant="body1" className="text-gray-600">
                {section === "Profile"
                  ? "Update your profile information and preferences"
                  : "Manage your account security and access keys"}
              </Typography>
            </div>
            {/* ANCHOR Profile Section */}
            {section === "Profile" && (
              <ShadowRoundedCard>
                <div className="flex flex-col [&>*+*]:!mt-4">
                  <RoseTextField
                    label="Full Name"
                    value={config.name}
                    onChange={(e) =>
                      setConfig({ ...config, name: e.target.value })
                    }
                    type="text"
                  />

                  <RoseTextField
                    label="Email Address"
                    type="email"
                    value={config.email}
                    onChange={(e) =>
                      setConfig({ ...config, email: e.target.value })
                    }
                  />

                  <RoseTextField
                    label="Biography"
                    type="text"
                    multiline
                    rows={4}
                    value={config.bio}
                    onChange={(e) =>
                      setConfig({ ...config, bio: e.target.value })
                    }
                  />

                  <div>
                    <RoseButton
                      label={saving ? "Saving Profile..." : "Save Profile"}
                      onClick={handleProfileSave}
                      disabled={saving}
                    />
                  </div>
                </div>
              </ShadowRoundedCard>
            )}

            {section === "Security" && (
              <div className="space-y-8">
                {/* Password Section */}
                <ShadowRoundedCard>
                  <div className="mb-8">
                    <Typography
                      variant="h5"
                      className="font-bold text-gray-900 mb-2 flex items-center"
                    >
                      <span className="mr-3">🔐</span>
                      Change Password
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Update your account password for better security
                    </Typography>
                  </div>

                  <div className="flex flex-col [&>*+*]:!mt-4">
                    <RoseTextField
                      type="password"
                      label="Current Password"
                      value={passwords.oldPwd}
                      onChange={(e) =>
                        setPasswords({ ...passwords, oldPwd: e.target.value })
                      }
                    />

                    <RoseTextField
                      type="password"
                      label="New Password"
                      value={passwords.newPwd}
                      onChange={(e) =>
                        setPasswords({ ...passwords, newPwd: e.target.value })
                      }
                    />

                    <RoseTextField
                      type="password"
                      label="Confirm New Password"
                      value={passwords.confirm}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirm: e.target.value })
                      }
                    />

                    <div>
                      <GreenButton
                        label={
                          saving ? "Updating Password..." : "Update Password"
                        }
                        onClick={handlePasswordSave}
                        disabled={
                          saving || passwords.newPwd !== passwords.confirm
                        }
                      />
                    </div>
                  </div>
                </ShadowRoundedCard>

                {/* Private Key Section */}
                <ShadowRoundedCard className="mt-8">
                  <div className="mb-8">
                    <Typography
                      variant="h5"
                      className="font-bold text-gray-900 mb-2 flex items-center"
                    >
                      <span className="mr-3">🗝️</span>
                      Private Key Management
                    </Typography>
                    <Typography variant="body2" className="text-gray-600">
                      Manage your private key for secure authentication
                    </Typography>
                  </div>

                  <div className="space-y-6 [&>*+*]:!mt-4">
                    <RoseTextField
                      type="text"
                      label="Private Key"
                      multiline
                      rows={6}
                      value={config.privateKey}
                      InputProps={{
                        readOnly: true,
                        className: "font-mono text-sm bg-gray-50/80",
                      }}
                      onChange={() => {}}
                    />

                    <OrangeButton
                      label={saving ? "Regenerating Key..." : "Regenerate Key"}
                      onClick={handleRegenerateKey}
                      disabled={saving}
                    />
                  </div>
                </ShadowRoundedCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
