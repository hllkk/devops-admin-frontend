import { useRouter } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import type { RouteKey } from '@elegant-router/types';
import { storeToRefs } from 'pinia';
import { router as globalRouter } from '@/router';
import { useRouteStore } from '@/store/modules/route';

/**
 * Router push
 *
 * Jump to the specified route, it can replace function router.push
 *
 * @param inSetup Whether is in vue script setup
 */
export function useRouterPush(inSetup = true) {
  const router = inSetup ? useRouter() : globalRouter;
  const route = globalRouter.currentRoute;

  const routerPush = router.push;

  const routerBack = router.back;

  async function routerPushByKey(key: RouteKey, options?: App.Global.RouterPushOptions) {
    const { query, params } = options || {};

    const routeLocation: RouteLocationRaw = {
      name: key
    };

    if (Object.keys(query || {}).length) {
      routeLocation.query = query;
    }

    if (Object.keys(params || {}).length) {
      routeLocation.params = params;
    }

    return routerPush(routeLocation);
  }

  function routerPushByKeyWithMetaQuery(key: RouteKey) {
    const allRoutes = router.getRoutes();
    const meta = allRoutes.find(item => item.name === key)?.meta || null;

    const query: Record<string, string> = {};

    meta?.query?.forEach(item => {
      query[item.key] = item.value;
    });

    return routerPushByKey(key, { query });
  }

  async function toHome() {
    // 使用 routeStore 中设置的首页路由（动态路由返回的 home）
    const routeStore = useRouteStore();
    const homeRoute = routeStore.routeHome;
    if (homeRoute) {
      return routerPushByKey(homeRoute as RouteKey);
    }
    // 降级：跳转到 root
    return routerPushByKey('disk');
  }

  /**
   * Navigate to login page
   *
   * @param loginModule The login module
   * @param redirectUrl The redirect url, if not specified, it will be the current route fullPath
   */
  async function toLogin(loginModule?: UnionKey.LoginModule, redirectUrl?: string) {
    const module = loginModule || 'pwd-login';

    const options: App.Global.RouterPushOptions = {
      params: {
        module
      }
    };

    const redirect = redirectUrl || route.value.fullPath;

    options.query = {
      redirect
    };

    return routerPushByKey('login', options);
  }

  /**
   * Toggle login module
   *
   * @param module
   */
  async function toggleLoginModule(module: UnionKey.LoginModule) {
    const query = route.value.query as Record<string, string>;

    return routerPushByKey('login', { query, params: { module } });
  }

  /**
   * Redirect from login
   *
   * @param [needRedirect=true] Whether to redirect after login. Default is `true`
   */
  async function redirectFromLogin(needRedirect = true) {
    const redirect = route.value.query?.redirect as string;

    if (needRedirect && redirect) {
      await routerPush(redirect);
    } else {
      await toHome();
    }
  }

  return {
    routerPush,
    routerBack,
    routerPushByKey,
    routerPushByKeyWithMetaQuery,
    toLogin,
    toggleLoginModule,
    redirectFromLogin
  };
}

/**
 * Shared page navigation composable
 *
 * 共享页面（个人中心、全部公告）导航，根据当前路径前缀自动拼接模块路径：
 * - 当前在 /disk/* → 导航到 /disk/{pageName}（网盘布局）
 * - 其他情况 → 导航到 /admin/{pageName}（后台管理布局）
 */
export function useSharedPageNav() {
  const router = useRouter();
  const routeStore = useRouteStore();
  const { currentModule } = storeToRefs(routeStore);

  /** 根据当前路径推断所在模块 */
  function inferModuleFromPath(): string {
    const path = router.currentRoute.value.path;
    if (path.startsWith('/disk')) return 'disk';
    return 'admin';
  }

  function navigateToSharedPage(pageName: string) {
    const module = inferModuleFromPath();
    return router.push(`/${module}/${pageName}`);
  }

  function getSharedPath(pageName: string): string {
    const module = inferModuleFromPath();
    return `/${module}/${pageName}`;
  }

  return { navigateToSharedPage, getSharedPath, currentModule };
}
