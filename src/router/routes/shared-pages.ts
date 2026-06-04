import type { ElegantConstRoute } from '@elegant-router/types';
import type { RouteModule } from '@/typings/router.d.ts';

/** Map from module name to the layout key in imports.ts */
export const MODULE_LAYOUT_MAP: Record<RouteModule, string> = {
  admin: 'base',
  disk: 'disk'
};

/** Map from module name to the home route key for tab initialization */
export const MODULE_HOME_MAP: Record<RouteModule, string> = {
  admin: 'admin',
  disk: 'disk'
};

/** All available modules — add new modules here */
export const ALL_MODULES: RouteModule[] = ['admin', 'disk'];

/** Shared page declaration — single source of truth */
export interface SharedPageConfig {
  /** The view name matching imports.ts views, e.g. 'user-center' */
  viewName: string;
  /** i18n key for the page title */
  i18nKey: string;
  /** Additional meta to merge */
  meta?: Partial<ElegantConstRoute['meta']>;
}

/**
 * Shared page configs — add one entry per cross-module page.
 * Routes for ALL modules are auto-generated from this list.
 */
export const SHARED_PAGE_CONFIGS: SharedPageConfig[] = [
  {
    viewName: 'user-center',
    i18nKey: 'route.user-center',
    meta: { hideInMenu: true, constant: true }
  },
  {
    viewName: 'notice-user',
    i18nKey: 'route.notice-user',
    meta: { hideInMenu: true, constant: true }
  }
];

/**
 * Convert a view name to PascalCase for route naming.
 * e.g. 'user-center' → 'UserCenter'
 *
 * IMPORTANT: elegant-router uses '_' as ROUTE_DEGREE_SPLITTER to determine route hierarchy.
 * Route names MUST NOT contain '_', otherwise the transform will misidentify them as nested routes.
 */
function toPascalRouteName(viewName: string): string {
  return viewName.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/**
 * Auto-generate module-specific routes from shared page configs.
 * Used in static route mode.
 */
export function generateSharedRoutes(configs: SharedPageConfig[]): ElegantConstRoute[] {
  return configs.flatMap(config =>
    ALL_MODULES.map(module => ({
      name: `${module}${toPascalRouteName(config.viewName)}`,
      path: `/${module}/${config.viewName}`,
      component: `layout.${MODULE_LAYOUT_MAP[module]}$view.${config.viewName}` as ElegantConstRoute['component'],
      meta: {
        title: config.viewName,
        i18nKey: config.i18nKey as App.I18n.I18nKey,
        ...config.meta,
        module
      }
    })) as ElegantConstRoute[]
  );
}

/**
 * Expand `layout.auto$view.xxx` routes into per-module variants.
 * Used in dynamic route mode — backend returns `layout.auto` for shared pages.
 */
export function expandAutoLayoutRoutes(routes: ElegantConstRoute[]): ElegantConstRoute[] {
  return routes.flatMap(route => expandAutoLayoutRoute(route));
}

function expandAutoLayoutRoute(route: ElegantConstRoute): ElegantConstRoute[] {
  const component = route.component as string | undefined;

  // layout.auto$view.xxx 路由不需要展开，auto layout 会根据当前模块动态切换
  if (component && component.startsWith('layout.auto$view.')) {
    return [route];
  }

  // Non-auto routes: recurse into children
  if (route.children?.length) {
    return [{ ...route, children: route.children.flatMap(child => expandAutoLayoutRoute(child)) }];
  }

  return [route];
}

/**
 * Build a path for a shared page.
 * Shared pages use root paths (e.g. /user-center) with auto layout that adapts to current module.
 */
export function getSharedPagePath(pageName: string): string {
  return `/${pageName}`;
}

let _router: any = null;

/** Set the router instance (called once during app init to avoid circular deps) */
export function setRouterForSharedPages(routerInstance: any) {
  _router = routerInstance;
}

/** Infer current module from the current route path */
function inferCurrentModule(): RouteModule {
  if (_router) {
    const path = _router.currentRoute.value.path;
    if (path.startsWith('/disk')) return 'disk';
  }
  return 'admin';
}
