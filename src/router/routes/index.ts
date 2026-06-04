import type { ElegantConstRoute, ElegantRoute } from '@elegant-router/types';
import type { RouteModule } from '@/typings/router';
import { generatedRoutes } from '../elegant/routes';
import { layouts, views } from '../elegant/imports';
import { transformElegantRoutesToVueRoutes } from '../elegant/transform';
import { generateSharedRoutes, SHARED_PAGE_CONFIGS, expandAutoLayoutRoutes } from './shared-pages';

/**
 * 指定路由使用的 layout（覆盖默认的 base layout）
 * key: 路由名称, value: layout 名称
 */
const routeLayoutMap: Record<string, string> = {
  login: "blank",
  '403': 'blank',
  '404': 'blank',
  '500': 'blank',
  init: 'blank',
  disk: 'disk'
};

/**
 * 指定路由所属的模块
 * 用于菜单按模块过滤显示
 * - admin: 管理中心模块（admin、manage 等页面）
 * - disk: 网盘模块（disk 页面）
 */
const routeModuleMap: Record<string, RouteModule> = {
  manage: 'admin',
  manage_user: 'admin',
  manage_role: 'admin',
  manage_menu: 'admin',
  manage_dept: 'admin',
  manage_post: 'admin',
  manage_dict: 'admin',
  manage_log: 'admin',
  manage_log_operation: 'admin',
  manage_log_login: 'admin',
  manage_settings: 'admin'
};

/**
 * 转换路由的 layout
 * elegant-router 默认所有路由使用 base layout，这里支持为特定路由指定不同的 layout
 */
function transformRouteLayout(routes: ElegantConstRoute[]): ElegantConstRoute[] {
  return routes.map(route => {
    const newRoute = { ...route } as ElegantConstRoute;
    const layoutName = routeLayoutMap[newRoute.name];

    if (layoutName && newRoute.component) {
      // 将 layout.base$view.xxx 转换为 layout.disk$view.xxx
      newRoute.component = newRoute.component.replace(/^layout\.[^$]+/, `layout.${layoutName}`) as ElegantConstRoute['component'];
    }

    // 添加 module 配置
    const moduleName = routeModuleMap[newRoute.name];
    if (moduleName && newRoute.meta) {
      newRoute.meta.module = moduleName;
    }

    if (newRoute.children) {
      newRoute.children = transformRouteLayout(newRoute.children);
    }

    return newRoute;
  });
}

/** create routes when the auth route mode is static */
export function createStaticRoutes() {
  const constantRoutes: ElegantRoute[] = [];

  const authRoutes: ElegantRoute[] = [];

  // Generate shared page routes from the registry
  const sharedRoutes = generateSharedRoutes(SHARED_PAGE_CONFIGS);

  // 转换路由 layout 和 module
  const transformedRoutes = transformRouteLayout(generatedRoutes).map(route => {
    // 将 user-center/notice-user 改为 auto layout，根据当前模块动态切换布局
    if (route.name === 'user-center' || route.name === 'notice-user') {
      route.component = `layout.auto$view.${route.name}` as ElegantConstRoute['component'];
      route.meta = {
        ...route.meta,
        hideInMenu: true,
        constant: true
      } as ElegantConstRoute['meta'];
    }
    return route;
  });

  [...sharedRoutes, ...transformedRoutes].forEach(item => {
    if (item.meta?.constant) {
      constantRoutes.push(item as ElegantRoute);
    } else {
      authRoutes.push(item as ElegantRoute);
    }
  });

  return {
    constantRoutes,
    authRoutes
  };
}

/**
 * Get auth vue routes
 *
 * Expands layout.auto routes into module-specific variants before transformation.
 *
 * @param routes Elegant routes
 */
export function getAuthVueRoutes(routes: ElegantConstRoute[]) {
  const expanded = expandAutoLayoutRoutes(routes);
  return transformElegantRoutesToVueRoutes(expanded, layouts, views);
}