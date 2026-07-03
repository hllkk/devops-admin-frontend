import type { LayoutMode } from '@sa/materials';
import type { LayoutPreset, RouteModule } from '@/typings/router';

/** 模块布局模式：'auto' 跟随用户全局主题，其余为模块固定模式 */
export type ModuleLayoutMode = LayoutMode | 'auto';

/** 单个模块的布局配置 */
export interface ModuleLayoutConfig {
  /** 结构预设：standard（标签页后台）| workbench（沉浸式工作台） */
  preset: LayoutPreset;
  /** 布局模式：'auto' 跟随用户全局主题；'vertical'/'horizontal' 为模块固定 */
  mode?: ModuleLayoutMode;
}

/**
 * 模块布局配置表 —— 「模块 → 布局」的唯一数据源。
 *
 * 新增模块时在此添加一行，即可赋予该模块独立的布局身份：
 * - `preset` 决定结构范式（tab/footer/header/菜单类型）
 * - `mode`  决定菜单方位；'auto' 表示跟随用户在主题抽屉里设的全局布局模式
 *
 * 注意：模块固定 mode 会与全局主题解耦——用户在 ThemeDrawer 切换布局模式时，
 * 固定 mode 的模块不受影响。详见 docs/模块布局配置.md
 */
export const MODULE_LAYOUT: Record<RouteModule, ModuleLayoutConfig> = {
  admin: { preset: 'standard', mode: 'auto' }, // 管理中心：跟随用户全局主题
  disk: { preset: 'workbench' }, // 网盘：沉浸式工作台（固定 vertical）
  server: { preset: 'standard', mode: 'auto' } // 服务器管理
};

/** 未知模块的回退配置（resolveModuleFromRoute 返回 null 时使用） */
export const DEFAULT_MODULE_LAYOUT: ModuleLayoutConfig = { preset: 'standard', mode: 'auto' };
