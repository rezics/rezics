import { Box, Button, Stack, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Foundation/Tokens",
  parameters: {
    docs: {
      description: {
        component:
          "Smoke-test of token wiring: surfaces, brand, text, and motion tokens resolve through MUI theme + CSS variables.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Surfaces: Story = {
  render: () => (
    <Stack spacing={4}>
      <Typography variant="h2">Surfaces</Typography>
      <Stack direction="row" spacing={2}>
        {(
          [
            ["canvas", "var(--rzc-color-surface-canvas)"],
            ["base", "var(--rzc-color-surface-base)"],
            ["raised", "var(--rzc-color-surface-raised)"],
            ["sunken", "var(--rzc-color-surface-sunken)"],
          ] as const
        ).map(([name, value]) => (
          <Box
            key={name}
            sx={{
              p: 3,
              minWidth: 140,
              bgcolor: value,
              border: "1px solid var(--rzc-color-border-whisper)",
              borderRadius: 1,
            }}
          >
            <Typography variant="overline">{name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  ),
};

export const Buttons: Story = {
  render: () => (
    <Stack spacing={3}>
      <Typography variant="h2">Buttons</Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained">Save</Button>
        <Button variant="outlined">Cancel</Button>
        <Button variant="text">More</Button>
      </Stack>
    </Stack>
  ),
};

export const Typography_: Story = {
  name: "Typography",
  render: () => (
    <Stack spacing={2}>
      <Typography variant="h1">Heading 1</Typography>
      <Typography variant="h2">Heading 2</Typography>
      <Typography variant="h3">Heading 3</Typography>
      <Typography variant="body1">
        Body 1 — Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Body 2 secondary — supporting text in muted token.
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Caption — 3 days ago
      </Typography>
    </Stack>
  ),
};

export const Brand: Story = {
  render: () => (
    <Stack spacing={3}>
      <Typography variant="h2">Brand 轮回红</Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 1,
            bgcolor: "var(--rzc-color-brand-fill)",
          }}
        />
        <Stack>
          <Typography
            variant="body1"
            sx={{ color: "var(--rzc-color-text-brand)" }}
            fontWeight={500}
          >
            Brand-text token (AA-safe)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            fill: #f4606c · text: auto-resolves to #C4433A light / #fa7882 dark
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  ),
};
