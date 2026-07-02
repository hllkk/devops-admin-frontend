import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { SetupStoreId } from '@/enum';
import { usePolling } from '@/hooks/common/polling';
import { fetchGetOverviewStats, fetchGetRealtimeMetrics, fetchGetRecentAlerts } from '@/service/api/server';

/**
 * 服务器管理共享 Store
 *
 * 仪表盘（Task 8）集中从此 Store 读取概览统计、实时指标与最近告警，
 * 并通过 startPolling / stopPolling 统一控制高频轮询。
 */
export const useServerStore = defineStore(SetupStoreId.Server, () => {
  /** 概览统计（顶部卡片 + 资源占用） */
  const overviewStats = ref<Api.Server.OverviewStats | null>(null);

  /** 实时资源指标（大屏高频轮询） */
  const realtimeMetrics = ref<Api.Server.RealtimeMetrics | null>(null);

  /** 最近告警列表 */
  const recentAlerts = ref<Api.Server.AlertItem[]>([]);

  /** 加载中标识（refreshOverview 执行期间为 true） */
  const loading = ref(false);

  /** 错误信息（任一请求失败时写入，成功时清空） */
  const errorMsg = ref<string | null>(null);

  /** CPU 使用率（百分比），无数据时为 0 */
  const cpu = computed(() => realtimeMetrics.value?.cpu ?? 0);

  /** 内存使用率（百分比），无数据时为 0 */
  const mem = computed(() => realtimeMetrics.value?.mem ?? 0);

  /** 磁盘使用率（百分比），无数据时为 0 */
  const disk = computed(() => realtimeMetrics.value?.disk ?? 0);

  /** 刷新概览：并行拉取三份数据，统一维护 loading 与 errorMsg */
  async function refreshOverview() {
    loading.value = true;
    errorMsg.value = null;

    const [stats, metrics, alerts] = await Promise.all([
      fetchGetOverviewStats(),
      fetchGetRealtimeMetrics(),
      fetchGetRecentAlerts()
    ]);

    loading.value = false;

    if (stats.error || metrics.error || alerts.error) {
      errorMsg.value = (stats.error || metrics.error || alerts.error)?.message ?? '加载失败';
      return;
    }

    overviewStats.value = stats.data;
    realtimeMetrics.value = metrics.data;
    recentAlerts.value = alerts.data ?? [];
  }

  /** 轮询控制：10s 间隔，非立即执行，页面隐藏时暂停 */
  const polling = usePolling(refreshOverview, 10000, { immediate: false, pauseOnHidden: true });

  function startPolling() {
    polling.start();
  }

  function stopPolling() {
    polling.stop();
  }

  return {
    overviewStats,
    realtimeMetrics,
    recentAlerts,
    loading,
    errorMsg,
    cpu,
    mem,
    disk,
    refreshOverview,
    startPolling,
    stopPolling
  };
});

export default useServerStore;
