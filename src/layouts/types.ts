import type { LayoutMode } from '@sa/materials';
import type { LayoutPreset } from '@/typings/router';

/** Layout shell configuration derived from a preset */
export interface LayoutPresetConfig {
  /** Whether the tab bar is visible */
  tabVisible: boolean;
  /** Whether the footer is visible */
  footerVisible: boolean;
  /** AdminLayout mode (vertical/horizontal) */
  mode: LayoutMode;
  /** Header variant: 'global' = full GlobalHeader, 'workbench' = compact breadcrumb header */
  header: 'global' | 'workbench';
  /** Optional layout-level plugins to mount */
  plugins?: Array<'upload-trigger'>;
}

/**
 * Preset → config mapping.
 * Add a new preset only when a genuinely new shell paradigm appears
 * (e.g. a fully immersive 3D surface). Per-business-module differences belong
 * in route content, not in a new preset.
 */
export const LAYOUT_PRESETS: Record<LayoutPreset, LayoutPresetConfig> = {
  standard: {
    tabVisible: true,
    footerVisible: true,
    mode: 'vertical',
    header: 'global'
  },
  workbench: {
    tabVisible: false,
    footerVisible: false,
    mode: 'vertical',
    header: 'workbench',
    plugins: ['upload-trigger']
  }
};
