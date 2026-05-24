/**
 * Office 配置管理 Hook
 */

import { ref, computed } from 'vue';
import { fetchGetOfficeConfig, fetchGetPublicOfficeConfig, fetchCheckOfficeHealth } from '@/service/api/disk/office';
import { getOfficeApiUrl } from '@/utils/office-config';
import type { ServerConfig } from '@/types/office';

/**
 * Office 配置 Hook
 * @param shareId 分享 ID (可选，用于公共分享场景)
 */
export function useOfficeConfig(shareId?: string) {
  /** 服务器配置 */
  const config = ref<ServerConfig | null>(null);

  /** 加载状态 */
  const loading = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  /** 是否已加载 */
  const isLoaded = computed(() => config.value !== null);

  /** 是否启用 JWT */
  const isTokenEnabled = computed(() => config.value?.tokenEnabled ?? false);

  /**
   * 加载服务器配置
   */
  async function loadConfig() {
    loading.value = true;
    error.value = null;

    try {
      const response = shareId
        ? await fetchGetPublicOfficeConfig(shareId)
        : await fetchGetOfficeConfig();

      config.value = response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取 Office 配置失败';
      console.error('Failed to load Office config:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取 API URL
   */
  function getApiUrl(): string {
    if (!config.value) {
      return getOfficeApiUrl();
    }
    return getOfficeApiUrl(config.value.documentServer);
  }

  /**
   * 获取回调服务器基础 URL
   * 如果后端没有配置，使用当前页面的 origin + /api
   * OnlyOffice 容器需要完整的绝对 URL
   */
  function getCallbackBaseUrl(): string {
    if (config.value?.callbackServer) {
      return config.value.callbackServer.replace(/\/$/, '');
    }
    // 自动补全：使用当前页面的 origin
    return `${window.location.origin}/api`;
  }

  /**
   * 重置配置
   */
  function reset() {
    config.value = null;
    error.value = null;
  }

  /**
   * 检查 OnlyOffice 服务可用性
   */
  async function checkHealth(): Promise<boolean> {
    try {
      const response = await fetchCheckOfficeHealth();
      return response.data?.available ?? false;
    } catch {
      return false;
    }
  }

  return {
    config,
    loading,
    error,
    isLoaded,
    isTokenEnabled,
    loadConfig,
    getApiUrl,
    getCallbackBaseUrl,
    checkHealth,
    reset
  };
}