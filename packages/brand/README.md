# @rezics/brand

Brand assets for REZICS. SVG is preferred; use PNG only where a platform does not accept SVG.

| Use case                                         | Asset                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| Full lockup for light or dark surfaces           | `logo.svg` / `logo-dark.svg`                           |
| Square mark without a background                 | `mark.svg`                                             |
| Monochrome printing, masks, and similar contexts | `mark-mono-dark.svg` / `mark-mono-light.svg`           |
| App, PWA, and desktop shortcut icons             | `app-icon.svg`, `app-icon.png`, or a size-specific PNG |
| Social-media avatars                             | `avatar.svg`, `avatar.png`, or `avatar@2x.png`         |
| Open Graph and sharing cards                     | `social-card.svg` / `social-card-dark.svg`             |

## Conventions

- Do not stretch, rotate, or alter the gradient.
- Keep the Z mark at its original `7:5` ratio in every variant. "Square" describes the canvas, not a stretched mark.
- Choose the light or dark lockup for its surface; do not invert it with CSS filters.
- App icons already include rounded corners and a safe area. Do not add padding when handing them to a platform that crops again.
- Important avatar content stays inside the circular safe area and can be used directly on platforms that crop avatars to circles.
- Custom sharing cards should retain the logo and safe area on the left, add the title on the right, and never be scaled down for avatar use.

Run `yarn workspace @rezics/brand generate` to rebuild `dist` from `src`. The generator derives dark and monochrome variants from the base assets; duplicate shape source files are not maintained.
`app-icon-180.png`, `app-icon-192.png`, and `app-icon-512.png` are generated from `app-icon.svg` for platforms that require those sizes.
