import type { LocationQueryRaw, RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router';
import type { ElegantConstRoute, RouteKey, RoutePath } from '@elegant-router/types';
import type { RouteModule } from '@/typings/router.d.ts';
import { useAuthStore } from '@/store/modules/auth';
import { useRouteStore } from '@/store/modules/route';
import { useTabStore } from '@/store/modules/tab';
import { getToken } from '@/store/modules/auth/shared';
import { localStg } from '@/utils/storage';
import { getRouteName } from '@/router/elegant/transform';
import { fetchCheckDB } from '@/service/api/init';
import { initProactiveRefresh } from '@/hooks/business/auth';
import { createStaticRoutes } from '@/router/routes';

// 初始化状态缓存配置
export const CHECK_DB_CACHE_KEY = 'check_db_result';
const CHECK_DB_CACHE_EXPIRE = 5 * 60 * 1000; // 5分钟缓存

interface CheckDBCache {
  needInit: boolean;
  timestamp: number;
}

// 初始化状态（内存缓存，避免路由守卫频繁调用 API）
let initStatusCache: { needInit: boolean; timestamp: number } | null = null;

/**
 * 清除初始化状态缓存（初始化成功后调用）
 */
export function clearInitStatusCache() {
  initStatusCache = null;
  localStg.remove(CHECK_DB_CACHE_KEY);
}

/**
 * 检查系统初始化状态（带缓存）
 */
async function checkInitStatus(): Promise<boolean> {
  const now = Date.now();

  // 优先使用内存缓存
  if (initStatusCache && (now - initStatusCache.timestamp) < CHECK_DB_CACHE_EXPIRE) {
    return initStatusCache.needInit;
  }

  // 使用 localStorage 缓存
  const cache = localStg.get(CHECK_DB_CACHE_KEY) as CheckDBCache | null;
  if (cache && (now - cache.timestamp) < CHECK_DB_CACHE_EXPIRE) {
    initStatusCache = cache;
    return cache.needInit;
  }

  // 调用 API 检查
  const { data, error } = await fetchCheckDB();
  if (!error && data) {
    const result = {
      needInit: data.needInit,
      timestamp: now
    };
    initStatusCache = result;
    localStg.set(CHECK_DB_CACHE_KEY, result);
    return data.needInit;
  }

  // API 调用失败，默认已初始化
  return false;
}

/**
 * Flatten route names from auth routes
 *
 * @param routes Auth routes
 * @returns Array of route names
 */
function flattenRouteNames(routes: ElegantConstRoute[]): string[] {
  const names: string[] = [];
  routes.forEach(route => {
    names.push(route.name as string);
    if (route.children?.length) {
      names.push(...flattenRouteNames(route.children));
    }
  });
  return names;
}

/**
 * Check if route is authorized for current user
 *
 * @param to Target route
 * @param routeStore Route store instance
 * @returns Whether the route is authorized
 */
function isRouteAuthorized(to: RouteLocationNormalized, routeStore: ReturnType<typeof useRouteStore>): boolean {
  // Constant routes are always accessible
  // Check to.meta (merged from parent+child in Vue Router)
  if (to.meta.constant) {
    return true;
  }

  // Fixed auth routes are accessible to all authenticated users
  if (to.meta.fixed) {
    return true;
  }

  // Also check all matched route records for constant/fixed flag
  // (handles single-level routes where parent meta doesn't have constant/fixed)
  const isConstantInMatched = to.matched.some(record => record.meta?.constant);
  if (isConstantInMatched) {
    return true;
  }
  const isFixedInMatched = to.matched.some(record => record.meta?.fixed);
  if (isFixedInMatched) {
    return true;
  }

  // 重定向路由始终允许访问
  const redirectRouteNames = ['disk_path'];
  const routeName = to.name as string;
  if (redirectRouteNames.includes(routeName)) {
    return true;
  }

  // Check if route name is in authorized routes
  const authorizedNames = flattenRouteNames(routeStore.authRoutes);

  return authorizedNames.includes(routeName);
}

/**
 * Collect all accessible modules from authorized routes
 */
function getAccessibleModules(routes: ElegantConstRoute[]): Set<RouteModule> {
  const modules = new Set<RouteModule>();
  routes.forEach(route => {
    const { module: routeModule, modules: routeModules } = route.meta ?? {};
    if (routeModule) modules.add(routeModule as RouteModule);
    if (routeModules) routeModules.forEach(m => modules.add(m as RouteModule));
    if (route.children?.length) {
      getAccessibleModules(route.children).forEach(m => modules.add(m));
    }
  });
  return modules;
}

/**
 * Check if route belongs to a module the user has access to (defense-in-depth)
 */
function isRouteModuleAccessible(to: RouteLocationNormalized, routeStore: ReturnType<typeof useRouteStore>): boolean {
  const { module: routeModule, modules: routeModules } = to.meta;

  // Global routes (no module info) are always accessible
  if (!routeModule && !(routeModules && routeModules.length > 0)) {
    return true;
  }

  const accessibleModules = getAccessibleModules(routeStore.authRoutes);

  // Check single module
  if (routeModule && accessibleModules.has(routeModule as RouteModule)) {
    return true;
  }

  // Check modules array
  if (routeModules && routeModules.some(m => accessibleModules.has(m as RouteModule))) {
    return true;
  }

  return false;
}

/**
 * create route guard
 *
 * @param router router instance
 */
export function createRouteGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const location = await initRoute(to);

    if (location) {
      return location;
    }

    const authStore = useAuthStore();
    const routeStore = useRouteStore();

    const rootRoute: RouteKey = 'root';
    const loginRoute: RouteKey = 'login';
    const noAuthorizationRoute: RouteKey = '403';

    const isLogin = Boolean(getToken() || localStg.get('isAuthenticated'));
    const needLogin = !to.meta.constant;
    const routeRoles = to.meta.roles || [];

    const hasRole = authStore.userInfo.roles.some(role => routeRoles.includes(role));
    const hasAuth = authStore.isStaticSuper || !routeRoles.length || hasRole;

    // if it is login route when logged in, then switch to the root page
    if (to.name === loginRoute && isLogin) {
      return { name: rootRoute };
    }

    // if the route does not need login, then it is allowed to access directly
    if (!needLogin) {
      return handleRouteSwitch(to, from);
    }

    // the route need login but the user is not logged in, then switch to the login page
    if (!isLogin) {
      return { name: loginRoute, query: { redirect: to.fullPath } };
    }

    // Fixed auth routes require login but skip role-based permission check
    // (accessible to ALL authenticated users)
    if (to.meta.fixed) {
      return handleRouteSwitch(to, from);
    }

    // if the user is logged in but does not have authorization, then switch to the 403 page
    if (!hasAuth) {
      return { name: noAuthorizationRoute };
    }

    // check if route is in user's authorized route list (dynamic route mode)
    if (routeStore.isInitAuthRoute && !isRouteAuthorized(to, routeStore)) {
      return { name: noAuthorizationRoute };
    }

    // check if route belongs to a module the user has access to (defense-in-depth)
    if (routeStore.isInitAuthRoute && !isRouteModuleAccessible(to, routeStore)) {
      return { name: noAuthorizationRoute };
    }

    // switch route normally
    return handleRouteSwitch(to, from);
  });
}

/**
 * initialize route
 *
 * @param to to route
 */
async function initRoute(to: RouteLocationNormalized): Promise<RouteLocationRaw | null> {
  const routeStore = useRouteStore();
  const tabStore = useTabStore();

  const notFoundRoute: RouteKey = 'not-found';
  const initRouteName: RouteKey = 'init';
  const loginRouteName: RouteKey = 'login';
  const isNotFoundRoute = to.name === notFoundRoute;
  const isInitRoute = to.name === initRouteName;

  // 【关键修改】先检查系统初始化状态
  // 注意：检查前需要先确保常量路由已注册（至少注册静态常量路由）
  // 否则跳转 { name: 'init' } 会失败，因为 Vue Router 不知道这个路由
  if (!routeStore.isInitConstantRoute) {
    // 先注册静态常量路由（确保 init、login 等基础页面可用）
    // 使用静态路由注册，不调用后端 API
    const staticRoute = createStaticRoutes();
    routeStore.addConstantRoutes(staticRoute.constantRoutes);
    routeStore.handleConstantAndAuthRoutes();
    routeStore.setIsInitConstantRoute(true);
    tabStore.initHomeTab();
  }

  // 然后检查系统初始化状态
  if (!isNotFoundRoute) {
    const needInit = await checkInitStatus();

    // 系统未初始化，访问非初始化页面时跳转到初始化页面
    if (needInit && !isInitRoute) {
      return { name: initRouteName };
    }

    // 系统已初始化，访问初始化页面时跳转到登录页面
    if (!needInit && isInitRoute) {
      return { name: loginRouteName };
    }
  }

  const isLogin = Boolean(getToken());

  if (!isLogin) {
    // if the user is not logged in and the route is a constant route but not the "not-found" route, then it is allowed to access.
    if (to.meta.constant && !isNotFoundRoute) {
      routeStore.onRouteSwitchWhenNotLoggedIn();

      return null;
    }

    // if the user is not logged in, then switch to the login page
    const loginRoute: RouteKey = 'login';
    const query = getRouteQueryOfLoginRoute(to, routeStore.routeHome);

    const location: RouteLocationRaw = {
      name: loginRoute,
      query
    };

    return location;
  }

  if (!routeStore.isInitAuthRoute) {
    // initialize the auth route
    await routeStore.initAuthRoute();

    // the route is captured by the "not-found" route because the auth route is not initialized
    // after the auth route is initialized, redirect to the original route
    if (isNotFoundRoute) {
      const rootRoute: RouteKey = 'root';
      const path = to.redirectedFrom?.name === rootRoute ? '/' : to.fullPath;

      const location: RouteLocationRaw = {
        path,
        replace: true,
        query: to.query,
        hash: to.hash
      };

      return location;
    }
  }

  routeStore.onRouteSwitchWhenLoggedIn();
  initProactiveRefresh();

  // the auth route is initialized
  // it is not the "not-found" route, then it is allowed to access
  if (!isNotFoundRoute) {
    return null;
  }

  // it is captured by the "not-found" route, then check whether the route exists
  const exist = await routeStore.getIsAuthRouteExist(to.path as RoutePath);
  const noPermissionRoute: RouteKey = '403';

  if (exist) {
    const location: RouteLocationRaw = {
      name: noPermissionRoute
    };

    return location;
  }

  return null;
}

function handleRouteSwitch(to: RouteLocationNormalized, from: RouteLocationNormalized) {
  // route with href
  if (to.meta.href) {
    window.open(to.meta.href, '_blank');

    return { path: from.fullPath, replace: true, query: from.query, hash: to.hash };
  }
}

function getRouteQueryOfLoginRoute(to: RouteLocationNormalized, routeHome: RouteKey) {
  const loginRoute: RouteKey = 'login';
  const redirect = to.fullPath;
  const [redirectPath, redirectQuery] = redirect.split('?');
  const redirectName = getRouteName(redirectPath as RoutePath);

  const isRedirectHome = routeHome === redirectName;

  const query: LocationQueryRaw = to.name !== loginRoute && !isRedirectHome ? { redirect } : {};

  if (isRedirectHome && redirectQuery) {
    query.redirect = `/?${redirectQuery}`;
  }

  return query;
}
