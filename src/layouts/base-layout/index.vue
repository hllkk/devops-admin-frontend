<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { AdminLayout, LAYOUT_SCROLL_EL_ID } from '@sa/materials';
import type { LayoutMode } from '@sa/materials';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import GlobalHeader from '../modules/global-header/index.vue';
import GlobalSider from '../modules/global-sider/index.vue';
import GlobalTab from '../modules/global-tab/index.vue';
import GlobalContent from '../modules/global-content/index.vue';
import GlobalFooter from '../modules/global-footer/index.vue';
import ThemeDrawer from '../modules/theme-drawer/index.vue';
import WorkbenchHeader from '../modules/workbench-header/index.vue';
import UploadTrigger from '@/components/custom/upload-trigger.vue';
import { provideMixMenuContext } from '../modules/global-menu/context';
import { useLayoutPreset } from '../composables/use-layout-preset';

defineOptions({
  name: 'BaseLayout'
});

const appStore = useAppStore();
const themeStore = useThemeStore();
const { preset, config, mode } = useLayoutPreset();
const { secondLevelMenus, childLevelMenus, isActiveFirstLevelMenuHasChildren } = provideMixMenuContext();

const GlobalMenu = defineAsyncComponent(() => import('../modules/global-menu/index.vue'));
const VerticalMixMenu = defineAsyncComponent(() => import('../modules/global-menu/modules/vertical-mix-menu.vue'));

const isWorkbench = computed(() => preset.value === 'workbench');

/**
 * Effective layout mode：模块固定 mode 覆盖用户全局主题。
 * - 模块 mode='horizontal'/'vertical' → 固定该模式
 * - 'auto' → 跟随 themeStore.layout.mode（用户在 ThemeDrawer 设的全局布局）
 * 菜单形态/headerProps/sider 等所有依赖布局模式的逻辑统一读此值，保证模块级布局生效。
 */
const effectiveLayoutMode = computed<UnionKey.ThemeLayoutMode>(() => {
  if (mode.value === 'horizontal') return 'horizontal';
  if (mode.value === 'vertical') return 'vertical';
  return themeStore.layout.mode;
});

const layoutMode = computed<LayoutMode>(() => {
  if (isWorkbench.value) return 'vertical';
  return effectiveLayoutMode.value.includes('vertical') ? 'vertical' : 'horizontal';
});

const headerProps = computed(() => {
  const headerPropsConfig: Record<UnionKey.ThemeLayoutMode, App.Global.HeaderProps> = {
    vertical: {
      showLogo: false,
      showMenu: false,
      showMenuToggler: true
    },
    'vertical-mix': {
      showLogo: false,
      showMenu: false,
      showMenuToggler: false
    },
    'vertical-hybrid-header-first': {
      showLogo: !isActiveFirstLevelMenuHasChildren.value,
      showMenu: true,
      showMenuToggler: false
    },
    horizontal: {
      showLogo: true,
      showMenu: true,
      showMenuToggler: false
    },
    'top-hybrid-sidebar-first': {
      showLogo: true,
      showMenu: true,
      showMenuToggler: false
    },
    'top-hybrid-header-first': {
      showLogo: true,
      showMenu: true,
      showMenuToggler: isActiveFirstLevelMenuHasChildren.value
    }
  };

  return headerPropsConfig[effectiveLayoutMode.value];
});

const siderVisible = computed(() => isWorkbench.value || effectiveLayoutMode.value !== 'horizontal');

const isVerticalMix = computed(() => effectiveLayoutMode.value === 'vertical-mix');

const isVerticalHybridHeaderFirst = computed(() => effectiveLayoutMode.value === 'vertical-hybrid-header-first');

const isTopHybridSidebarFirst = computed(() => effectiveLayoutMode.value === 'top-hybrid-sidebar-first');

const isTopHybridHeaderFirst = computed(() => effectiveLayoutMode.value === 'top-hybrid-header-first');

const siderWidth = computed(() => (isWorkbench.value ? getWorkbenchSiderWidth(false) : getSiderAndCollapsedWidth(false)));

const siderCollapsedWidth = computed(() => (isWorkbench.value ? getWorkbenchSiderWidth(true) : getSiderAndCollapsedWidth(true)));

/** workbench 固定 vertical + mix 菜单范式，sider 宽度按 mix 计算（等价于原 disk-layout） */
function getWorkbenchSiderWidth(isCollapsed: boolean) {
  const { mixWidth, mixCollapsedWidth, mixChildMenuWidth } = themeStore.sider;
  if (isCollapsed) return mixCollapsedWidth;
  return mixWidth + (appStore.mixSiderFixed && secondLevelMenus.value.length ? mixChildMenuWidth : 0);
}

function getSiderAndCollapsedWidth(isCollapsed: boolean) {
  const {
    mixChildMenuWidth,
    collapsedWidth,
    width: themeWidth,
    mixCollapsedWidth,
    mixWidth: themeMixWidth
  } = themeStore.sider;

  const width = isCollapsed ? collapsedWidth : themeWidth;
  const mixWidth = isCollapsed ? mixCollapsedWidth : themeMixWidth;

  if (isTopHybridHeaderFirst.value) {
    return isActiveFirstLevelMenuHasChildren.value ? width : 0;
  }

  if (isVerticalHybridHeaderFirst.value && !isActiveFirstLevelMenuHasChildren.value) {
    return 0;
  }

  const isMixMode = isVerticalMix.value || isTopHybridSidebarFirst.value || isVerticalHybridHeaderFirst.value;
  let finalWidth = isMixMode ? mixWidth : width;

  if (isVerticalMix.value && appStore.mixSiderFixed && secondLevelMenus.value.length) {
    finalWidth += mixChildMenuWidth;
  }

  if (isVerticalHybridHeaderFirst.value && appStore.mixSiderFixed && childLevelMenus.value.length) {
    finalWidth += mixChildMenuWidth;
  }

  return finalWidth;
}
</script>

<template>
  <AdminLayout
    v-model:sider-collapse="appStore.siderCollapse"
    :mode="layoutMode"
    :scroll-el-id="LAYOUT_SCROLL_EL_ID"
    :scroll-mode="themeStore.layout.scrollMode"
    :is-mobile="appStore.isMobile"
    :full-content="appStore.fullContent"
    :fixed-top="themeStore.fixedHeaderAndTab"
    :header-height="themeStore.header.height"
    :tab-visible="config.tabVisible && themeStore.tab.visible"
    :tab-height="themeStore.tab.height"
    :content-class="appStore.contentXScrollable ? 'overflow-x-hidden' : ''"
    :sider-visible="siderVisible"
    :sider-width="siderWidth"
    :sider-collapsed-width="siderCollapsedWidth"
    :footer-visible="config.footerVisible && themeStore.footer.visible"
    :footer-height="themeStore.footer.height"
    :fixed-footer="themeStore.footer.fixed"
    :right-footer="themeStore.footer.right"
  >
    <template #header>
      <GlobalHeader v-if="config.header === 'global'" v-bind="headerProps" />
      <WorkbenchHeader v-else />
    </template>
    <template #tab>
      <GlobalTab />
    </template>
    <template #sider>
      <GlobalSider />
    </template>
    <GlobalMenu v-if="!isWorkbench" :mode="effectiveLayoutMode" />
    <VerticalMixMenu v-else :key="appStore.isMobile ? 'mobile' : 'desktop'" />
    <GlobalContent />
    <UploadTrigger v-if="config.plugins?.includes('upload-trigger')" />
    <ThemeDrawer />
    <template #footer>
      <GlobalFooter />
    </template>
  </AdminLayout>
</template>

<style lang="scss">
#__SCROLL_EL_ID__ {
  @include scrollbar();
}
</style>
