import type { RouteMeta } from 'vue-router';
import ElegantVueRouter from '@elegant-router/vue/vite';
import type { RouteKey } from '@elegant-router/types';
import type { RouteModule } from '../../src/typings/router.d.ts';

const routeMetaConfig: Record<string, Partial<RouteMeta> & { module?: RouteModule }> = {
  admin: {
    icon: 'mdi:monitor-dashboard',
    order: 1,
    fixedIndexInTab: 0,
    module: 'admin'
  },
  disk: {
    icon: 'mdi:harddisk',
    order: 2,
    module: 'disk'
  },
  manage: {
    icon: 'mdi:cog',
    order: 3,
    module: 'admin'
  },
  // 系统管理子菜单 - 按顺序排列
  manage_user: {
    icon: 'mdi:account',
    order: 1
  },
  manage_role: {
    icon: 'mdi:account-group',
    order: 2
  },
  manage_menu: {
    icon: 'mdi:menu',
    order: 3
  },
  manage_dept: {
    icon: 'mdi:office-building',
    order: 4
  },
  manage_post: {
    icon: 'mdi:briefcase',
    order: 5
  },
  manage_dict: {
    icon: 'mdi:book-open-variant',
    order: 6
  },
  manage_log: {
    icon: 'mdi:text-box-outline',
    order: 7
  },
  manage_log_operation: {
    icon: 'mdi:text-box-search',
    order: 1
  },
  manage_log_login: {
    icon: 'mdi:login',
    order: 2
  },
  manage_settings: {
    icon: 'mdi:cog-outline',
    order: 8
  },
  // 服务器管理模块
  server: {
    icon: 'mdi:view-dashboard-outline',
    order: 5,
    fixedIndexInTab: 0,
    module: 'server'
  },
  'server-manage': {
    icon: 'mdi:server-network',
    order: 6,
    module: 'server'
  },
  'server-manage_monitor': {
    icon: 'mdi:monitor-eye',
    order: 1
  },
  'server-manage_server-list': {
    icon: 'mdi:server',
    order: 2
  },
  'server-manage_server-detail': {
    icon: 'mdi:server-outline',
    order: 3
  },
  // 网关模块
  gateway: {
    icon: 'mdi:router-network',
    order: 4,
    module: 'gateway'
  },
  gateway_dashboard: {
    icon: 'mdi:view-dashboard',
    order: 1
  },
  gateway_provider: {
    icon: 'mdi:domain',
    order: 2
  },
  'gateway_ai-key': {
    icon: 'mdi:key-variant',
    order: 3
  },
  gateway_project: {
    icon: 'mdi:folder-network',
    order: 4
  }
};

export function setupElegantRouter() {
  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',
      blank: 'src/layouts/blank-layout/index.vue',
      // 'disk' 复用 BaseLayout（workbench 预设由 useLayoutPreset 按路径识别）。
      // 保留 disk key 以兼容后端动态路由下发的 component='layout.disk'。
      disk: 'src/layouts/base-layout/index.vue'
    },
    routePathTransformer(routeName, routePath) {
      const key = routeName as RouteKey;

      if (key === 'login') {
        const modules: UnionKey.LoginModule[] = ['pwd-login', 'code-login', 'register', 'reset-pwd', 'bind-wechat', 'wecom-login'];

        const moduleReg = modules.join('|');

        return '/login/:module(' + moduleReg + ')?';
      }

      return routePath;
    },
    onRouteMetaGen(routeName) {
      const key = routeName as RouteKey;

      const constantRoutes: RouteKey[] = ['login', '403', '404', '500'];

      const meta: Partial<RouteMeta> = {
        title: key,
        i18nKey: 'route.' + key as App.I18n.I18nKey
      };

      if (constantRoutes.includes(key)) {
        meta.constant = true;
      }

      const extraConfig = routeMetaConfig[key];
      if (extraConfig) {
        Object.assign(meta, extraConfig);
      }

      return meta;
    }
  });
}