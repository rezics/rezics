// uno.config.ts
import {defineConfig, presetIcons, presetAttributify} from 'unocss';
import transformerDirectives from '@unocss/transformer-directives';
import presetWind4 from '@unocss/preset-wind4';
import presetAnimations from 'unocss-preset-animations';
import {builtinColors, presetShadcn} from 'unocss-preset-shadcn';
import {presetScrollbarHide} from 'unocss-preset-scrollbar-hide';

export default defineConfig({
  content: {
    filesystem: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  },

  theme: {
    breakpoints: {
      xs: '0px',
      sm: '600px',
      md: '900px',
      lg: '1200px',
      xl: '1536px',
    },
    colors: {
      primary: {
        main: 'var(--mui-palette-primary-main)',
        light: 'var(--mui-palette-primary-light)',
        dark: 'var(--mui-palette-primary-dark)',
      },
      secondary: {
        main: 'var(--mui-palette-secondary-main)',
        light: 'var(--mui-palette-secondary-light)',
        dark: 'var(--mui-palette-secondary-dark)',
      },
    },
  },

  presets: [
    presetWind4({
      preflights: {
        reset: true,
      },
    }),
    presetShadcn(builtinColors.map(c => ({color: c}))),
    presetAnimations(),
    presetIcons(), // for icons
    presetAttributify({
      prefix: 'un-',
      prefixedOnly: true,
    }), // support <div un-text="red-500">
    // * small presets below
    presetScrollbarHide(),
  ],

  transformers: [transformerDirectives()],

  shortcuts: {},
  rules: [],
});
