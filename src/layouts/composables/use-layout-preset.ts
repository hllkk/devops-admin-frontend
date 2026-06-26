import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { LayoutPreset } from '@/typings/router';
import { resolveModuleFromRoute } from '@/store/modules/route/shared';
import { LAYOUT_PRESETS } from '../types';
import { DEFAULT_MODULE_LAYOUT, MODULE_LAYOUT } from '../module-layout';
import type { ModuleLayoutMode } from '../module-layout';

/**
 * Resolve the current route's layout config from the module layout table.
 *
 * - `preset` → shell structure (standard/workbench), drives AdminLayout props
 * - `mode`   → layout mode ('auto' follows user's global theme; otherwise fixed)
 * - `config` → resolved preset config (tab/footer/header/plugins)
 *
 * Module isolation (which menus show) is handled separately by the route store
 * (filterRoutesByModule); this composable only controls the layout shell.
 */
export function useLayoutPreset() {
  const route = useRoute();

  const moduleLayout = computed(() => {
    const m = resolveModuleFromRoute(route);
    return (m && MODULE_LAYOUT[m]) || DEFAULT_MODULE_LAYOUT;
  });

  const preset = computed<LayoutPreset>(() => moduleLayout.value.preset);
  const config = computed(() => LAYOUT_PRESETS[preset.value]);
  const mode = computed<ModuleLayoutMode>(() => moduleLayout.value.mode ?? 'auto');

  return { preset, config, mode };
}
