import type { RouteLocationNormalizedLoaded, RouteRecordRaw, _RouteRecordBase } from 'vue-router';
import type { RouteModule } from '@/typings/router.d.ts';
import type { ElegantConstRoute, LastLevelRouteKey, RouteKey, RouteMap } from '@elegant-router/types';
import { MODULE_HOME_MAP } from '@/router/routes/shared-pages';
import { useSvgIcon } from '@/hooks/common/icon';
import { $t } from '@/locales';

/**
 * Filter auth routes by roles
 *
 * @param routes Auth routes
 * @param roles Roles
 */
export function filterAuthRoutesByRoles(routes: ElegantConstRoute[], roles: string[]) {
  return routes.flatMap(route => filterAuthRouteByRoles(route, roles));
}

/**
 * Filter auth route by roles
 *
 * @param route Auth route
 * @param roles Roles
 */
function filterAuthRouteByRoles(route: ElegantConstRoute, roles: string[]): ElegantConstRoute[] {
  // Fixed auth routes are accessible to ALL authenticated users, skip role filtering
  if (route.meta?.fixed) {
    const filterRoute = { ...route };
    if (filterRoute.children?.length) {
      filterRoute.children = filterRoute.children.flatMap(item => filterAuthRouteByRoles(item, roles));
    }
    return [filterRoute];
  }

  const routeRoles = (route.meta && route.meta.roles) || [];

  // if the route's "roles" is empty, then it is allowed to access
  const isEmptyRoles = !routeRoles.length;

  // if the user's role is included in the route's "roles", then it is allowed to access
  const hasPermission = routeRoles.some(role => roles.includes(role));

  const filterRoute = { ...route };

  if (filterRoute.children?.length) {
    filterRoute.children = filterRoute.children.flatMap(item => filterAuthRouteByRoles(item, roles));
  }

  // Exclude the route if it has no children after filtering
  if (filterRoute.children?.length === 0) {
    return [];
  }

  return hasPermission || isEmptyRoles ? [filterRoute] : [];
}

/**
 * sort route by order
 *
 * @param route route
 */
function sortRouteByOrder(route: ElegantConstRoute) {
  if (route.children?.length) {
    route.children.sort((next, prev) => (Number(next.meta?.order) || 0) - (Number(prev.meta?.order) || 0));
    route.children.forEach(sortRouteByOrder);
  }

  return route;
}

/**
 * sort routes by order
 *
 * @param routes routes
 */
export function sortRoutesByOrder(routes: ElegantConstRoute[]) {
  routes.sort((next, prev) => (Number(next.meta?.order) || 0) - (Number(prev.meta?.order) || 0));
  routes.forEach(sortRouteByOrder);

  return routes;
}

/**
 * Get global menus by auth routes
 *
 * @param routes Auth routes
 */
export function getGlobalMenusByAuthRoutes(routes: ElegantConstRoute[]) {
  const menus: App.Global.Menu[] = [];

  routes.forEach(route => {
    // Hide routes that are explicitly marked as hideInMenu or are constant (builtin) routes
    // Fixed routes are permission-level (all authenticated users) — they should appear in menus
    if (!route.meta?.hideInMenu && !route.meta?.constant) {
      const menu = getGlobalMenuByBaseRoute(route);

      if (route.children?.some(child => !child.meta?.hideInMenu && !child.meta?.constant)) {
        menu.children = getGlobalMenusByAuthRoutes(route.children);
      }

      menus.push(menu);
    }
  });

  return menus;
}

/**
 * Update locale of global menus
 *
 * @param menus
 */
export function updateLocaleOfGlobalMenus(menus: App.Global.Menu[]) {
  const result: App.Global.Menu[] = [];

  menus.forEach(menu => {
    const { i18nKey, label, children } = menu;

    const newLabel = i18nKey ? $t(i18nKey) : label;

    const newMenu: App.Global.Menu = {
      ...menu,
      label: newLabel
    };

    if (children?.length) {
      newMenu.children = updateLocaleOfGlobalMenus(children);
    }

    result.push(newMenu);
  });

  return result;
}

/**
 * Get global menu by route
 *
 * @param route
 */
function getGlobalMenuByBaseRoute(route: RouteLocationNormalizedLoaded | ElegantConstRoute) {
  const { SvgIconVNode } = useSvgIcon();

  const { name, path } = route;
  const { title, i18nKey, icon = import.meta.env.VITE_MENU_ICON, localIcon, iconFontSize } = route.meta ?? {};

  const label = i18nKey ? $t(i18nKey) : title!;

  const menu: App.Global.Menu = {
    key: name as string,
    label,
    i18nKey,
    routeKey: name as RouteKey,
    routePath: path as RouteMap[RouteKey],
    icon: SvgIconVNode({ icon, localIcon, fontSize: iconFontSize || 20 })
  };

  return menu;
}

/**
 * Get cache route names
 *
 * @param routes Vue routes (two levels)
 */
export function getCacheRouteNames(routes: RouteRecordRaw[]) {
  const cacheNames: LastLevelRouteKey[] = [];

  routes.forEach(route => {
    // only get last two level route, which has component
    route.children?.forEach(child => {
      if (child.component && child.meta?.keepAlive) {
        cacheNames.push(child.name as LastLevelRouteKey);
      }
    });
  });

  return cacheNames;
}

/**
 * Is route exist by route name
 *
 * @param routeName
 * @param routes
 */
export function isRouteExistByRouteName(routeName: RouteKey, routes: ElegantConstRoute[]) {
  return routes.some(route => recursiveGetIsRouteExistByRouteName(route, routeName));
}

/**
 * Recursive get is route exist by route name
 *
 * @param route
 * @param routeName
 */
function recursiveGetIsRouteExistByRouteName(route: ElegantConstRoute, routeName: RouteKey) {
  let isExist = route.name === routeName;

  if (isExist) {
    return true;
  }

  if (route.children && route.children.length) {
    isExist = route.children.some(item => recursiveGetIsRouteExistByRouteName(item, routeName));
  }

  return isExist;
}

/**
 * Get selected menu key path
 *
 * @param selectedKey
 * @param menus
 */
export function getSelectedMenuKeyPathByKey(selectedKey: string, menus: App.Global.Menu[]) {
  const keyPath: string[] = [];

  menus.some(menu => {
    const path = findMenuPath(selectedKey, menu);

    const find = Boolean(path?.length);

    if (find) {
      keyPath.push(...path!);
    }

    return find;
  });

  return keyPath;
}

/**
 * Find menu path
 *
 * @param targetKey Target menu key
 * @param menu Menu
 */
function findMenuPath(targetKey: string, menu: App.Global.Menu): string[] | null {
  const path: string[] = [];

  function dfs(item: App.Global.Menu): boolean {
    path.push(item.key);

    if (item.key === targetKey) {
      return true;
    }

    if (item.children) {
      for (const child of item.children) {
        if (dfs(child)) {
          return true;
        }
      }
    }

    path.pop();

    return false;
  }

  if (dfs(menu)) {
    return path;
  }

  return null;
}

/**
 * Transform menu to breadcrumb
 *
 * @param menu
 */
function transformMenuToBreadcrumb(menu: App.Global.Menu) {
  const { children, ...rest } = menu;

  const breadcrumb: App.Global.Breadcrumb = {
    ...rest
  };

  if (children?.length) {
    breadcrumb.options = children.map(transformMenuToBreadcrumb);
  }

  return breadcrumb;
}

/**
 * Get breadcrumbs by route
 *
 * @param route
 * @param menus
 */
export function getBreadcrumbsByRoute(
  route: RouteLocationNormalizedLoaded,
  menus: App.Global.Menu[]
): App.Global.Breadcrumb[] {
  const key = route.name as string;
  const activeKey = route.meta?.activeMenu;

  for (const menu of menus) {
    if (menu.key === key) {
      return [transformMenuToBreadcrumb(menu)];
    }

    if (menu.key === activeKey) {
      const ROUTE_DEGREE_SPLITTER = '_';

      const parentKey = key.split(ROUTE_DEGREE_SPLITTER).slice(0, -1).join(ROUTE_DEGREE_SPLITTER);

      const breadcrumbMenu = getGlobalMenuByBaseRoute(route);
      if (parentKey !== activeKey) {
        return [transformMenuToBreadcrumb(breadcrumbMenu)];
      }

      return [transformMenuToBreadcrumb(menu), transformMenuToBreadcrumb(breadcrumbMenu)];
    }

    if (menu.children?.length) {
      const result = getBreadcrumbsByRoute(route, menu.children);
      if (result.length > 0) {
        return [transformMenuToBreadcrumb(menu), ...result];
      }
    }
  }

  return [];
}

/**
 * Transform menu to searchMenus
 *
 * @param menus - menus
 * @param treeMap
 */
export function transformMenuToSearchMenus(menus: App.Global.Menu[], treeMap: App.Global.Menu[] = []) {
  if (menus && menus.length === 0) return [];
  return menus.reduce((acc, cur) => {
    if (!cur.children) {
      acc.push(cur);
    }
    if (cur.children && cur.children.length > 0) {
      transformMenuToSearchMenus(cur.children, treeMap);
    }
    return acc;
  }, treeMap);
}

/**
 * Filter routes by module
 *
 * @param routes Routes
 * @param module Current module
 */
export function filterRoutesByModule(routes: ElegantConstRoute[], module: RouteModule) {
  return routes.flatMap(route => filterRouteByModule(route, module));
}

/**
 * Filter route by module
 *
 * - meta.module === current module ⇒ keep
 * - no meta.module ⇒ global route (404/login/user-center etc.), visible in all modules
 *
 * @param route Route
 * @param module Current module
 */
function filterRouteByModule(route: ElegantConstRoute, module: RouteModule): ElegantConstRoute[] {
  const { module: routeModule } = route.meta ?? {};

  // No module ⇒ global route (visible in all modules)
  const isGlobalRoute = !routeModule;
  const isCurrentModule = routeModule === module;

  const filterRoute = { ...route };

  if (filterRoute.children?.length) {
    filterRoute.children = filterRoute.children.flatMap(item => filterRouteByModule(item, module));
  }

  // Exclude the route if it has no children after filtering
  if (filterRoute.children?.length === 0) {
    return [];
  }

  return isGlobalRoute || isCurrentModule ? [filterRoute] : [];
}

/**
 * Filter menus by module
 *
 * @param menus Menus
 * @param module Current module
 */
export function filterMenusByModule(menus: App.Global.Menu[], _module: RouteModule): App.Global.Menu[] {
  return menus.filter(_menu => {
    // Keep menus that don't have module specified (global)
    // Or keep menus that match current module
    return true; // For now, return all menus, filtering is done at route level
  });
}

/**
 * Resolve the module a route belongs to.
 *
 * - meta.module (single string) — the sole source of truth after signal unification
 * - Path prefix fallback (defensive): /disk → 'disk', /admin|/manage → 'admin'.
 *   Normally every route carries meta.module; this only triggers if one is missing it.
 */
export interface ModuleResolvableRoute {
  meta?: { module?: RouteModule };
  path?: string;
}

export function resolveModuleFromRoute(route: ModuleResolvableRoute): RouteModule | null {
  const { module } = route.meta ?? {};
  if (module) return module as RouteModule;
  const path = route.path ?? '';
  if (path.startsWith('/disk')) return 'disk';
  if (path.startsWith('/server')) return 'server';
  if (path.startsWith('/gateway')) return 'gateway';
  if (path.startsWith('/admin') || path.startsWith('/manage')) return 'admin';
  return null;
}

/**
 * Get the home route key for a module.
 *
 * Returns undefined if the module is not in MODULE_HOME_MAP,
 * so callers can apply their own fallback chain.
 */
export function getModuleHomeKey(module?: RouteModule | null): RouteKey | undefined {
  return module ? (MODULE_HOME_MAP[module] as RouteKey) : undefined;
}
