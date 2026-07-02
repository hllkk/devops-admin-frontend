import { defineConfig, transformerDirectives, transformerVariantGroup, presetWind3 } from 'unocss';
import { presetSoybeanAdmin } from '@sa/uno-preset';
import { themeVars } from './src/theme/vars';

export default defineConfig({
  content: {
    pipeline: {
      exclude: ['node_modules', 'dist']
    }
  },
  theme: {
    ...themeVars,
    fontSize: {
      'icon-xs': '0.875rem',
      'icon-small': '1rem',
      icon: '1.125rem',
      'icon-large': '1.5rem',
      'icon-xl': '2rem'
    }
  },
  shortcuts: {
    'card-wrapper': 'rd-8px shadow-sm',
    'glass-card': 'backdrop-blur-xl bg-white/5 border border-white/10 rd-12px',
    'glass-panel': 'backdrop-blur-2xl bg-white/[0.06] border-t-2 border-white/15 rd-12px shadow-[0_8px_32px_rgba(0,0,0,0.37)]'
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
  presets: [presetWind3({ dark: 'class' }), presetSoybeanAdmin()]
});
