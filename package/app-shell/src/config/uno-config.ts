import {defineConfig, presetIcons, presetAttributify} from 'unocss';
import transformerDirectives from '@unocss/transformer-directives';
import presetWind4 from '@unocss/preset-wind4';
import presetAnimations from 'unocss-preset-animations';
import {builtinColors, presetShadcn} from 'unocss-preset-shadcn';
import {presetScrollbarHide} from 'unocss-preset-scrollbar-hide';

export function createUnoConfig() {
  return defineConfig({
    theme: {
      breakpoint: {
        xs: '0px',
        xsm: '450px', // 基础移动端
        sm: '640px', // 大屏手机 / 小型平板
        md: '768px', // 平板电脑 (iPad 纵向)
        lg: '1024px', // 笔记本电脑 (iPad 横向 / 小屏 PC)
        xl: '1280px', // 标准桌面显示器
        '2xl': '1536px', // 大屏显示器 / 高分屏
      },
      container: {
        xs: '0px',
        xsm: '450px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      spacing: {
        '4': '1rem', // TODO 完全不知道到底是谁在用这个东西，不应该有人用才对，但是没有会报错
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
      presetWind4({preflights: {reset: true}}),
      presetShadcn(builtinColors.map(c => ({color: c}))),
      presetAnimations(),
      presetIcons(),
      presetAttributify({
        prefix: 'un-',
        prefixedOnly: true,
      }), // support <div un-text="red-500">
      // * small presets below
      presetScrollbarHide(),
    ],
    transformers: [transformerDirectives()],
    shortcuts: {
      'horizontal-book-carousel':
        'pl-4 !basis-1/3 xsm:!basis-1/4 sm:!basis-1/5 md:!basis-1/6 lg:!basis-1/7 xl:!basis-1/8',
    },
  });
}
