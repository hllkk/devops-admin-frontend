import { ref, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue';

/**
 * 无限滚动 hook — 监听滚动容器的 scroll 事件
 * 当滚动到底部附近（距底部 ≤ threshold px）时触发 loadMore
 *
 * 优势：不受容器嵌套层级影响，只需知道哪个 HTMLElement 是滚动容器
 */
interface UseInfiniteScrollOptions {
  /** 加载更多数据的回调 */
  onLoadMore: () => Promise<void>;
  /** 是否还有更多数据可加载 */
  hasMore: Ref<boolean>;
  /** 滚动容器 ref — 内部有 overflow-y-auto 的 div 或 NDataTable wrapper */
  scrollContainerRef: Ref<HTMLElement | null>;
  /** 触发加载的距离阈值（px），距底部多少 px 时触发，默认 200 */
  threshold?: number;
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const { onLoadMore, hasMore, scrollContainerRef, threshold = 200 } = options;

  const loadingMore = ref(false);

  function handleScroll() {
    const el = scrollContainerRef.value;
    if (!el || !hasMore.value || loadingMore.value) return;

    // 判断是否接近底部：scrollTop + clientHeight + threshold >= scrollHeight
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom <= threshold) {
      triggerLoadMore();
    }
  }

  async function triggerLoadMore() {
    if (loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    try {
      await onLoadMore();
    } finally {
      loadingMore.value = false;
    }
  }

  let boundElement: HTMLElement | null = null;

  function bindScrollListener() {
    // 先解绑旧元素
    if (boundElement) {
      boundElement.removeEventListener('scroll', handleScroll);
      boundElement = null;
    }

    const el = scrollContainerRef.value;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    boundElement = el;
  }

  onMounted(() => {
    nextTick(bindScrollListener);
  });

  // 滚动容器可能延迟渲染或切换（grid ↔ list），需要动态重新绑定
  watch(scrollContainerRef, () => {
    nextTick(bindScrollListener);
  });

  onUnmounted(() => {
    if (boundElement) {
      boundElement.removeEventListener('scroll', handleScroll);
    }
  });

  return { loadingMore };
}
