import { ref } from 'vue';

/**
 * 全局全屏 Loading 状态（module-level 单例，跨组件共享同一个遮罩实例）。
 *
 * 用法：
 *   const { show, hide } = useFullScreenLoading();
 *   show($t('page.disk.trash.restoring', { count: n }));
 *   try { await op(); } finally { hide(); }
 */
const visible = ref(false);
const loadingText = ref('');

export function useFullScreenLoading() {
  function show(text = '') {
    loadingText.value = text;
    visible.value = true;
  }

  function hide() {
    visible.value = false;
    loadingText.value = '';
  }

  return { visible, loadingText, show, hide };
}
