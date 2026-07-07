<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';
import { useAuthStore } from '@/store/modules/auth';
import { storeToRefs } from 'pinia';
import {
  fetchGetOfficeJwt,
  fetchGetPublicOfficeJwt,
  fetchGetFileInfoById,
  fetchGetPublicFileInfoById
} from '@/service/api/disk/office';
import { fetchRestoreHistory, fetchDeleteHistory, fetchHistoryList } from '@/service/api/disk/editor';
import { useOfficeConfig } from '@/hooks/business/use-office-config';
import {
  getOfficePreviewUrl,
  getOfficeSharePreviewUrl,
  getOfficeCallbackUrl,
  generateDocumentKey,
  normalizeFileType,
  loadOfficeApi,
  getOfficeHistoryPreviewUrl
} from '@/utils/office-config';
import HistoryVersionPopover from './history-version-popover.vue';
import type { EditorConfig, DocEditorInstance } from '@/typings/office';

defineOptions({ name: 'OfficePreview' });

interface FileInfo {
  id: CommonType.IdType;
  name: string;
  path: string;
  suffix: string;
  size: number;
  contentType: string;
  updateTime: string;
  userId?: CommonType.IdType;
}

interface Props {
  file?: FileInfo;
  fileId?: CommonType.IdType;
  readOnly?: boolean;
  shareId?: string;
  shareToken?: string;
}

const props = withDefaults(defineProps<Props>(), {
  file: undefined,
  fileId: undefined,
  readOnly: false,
  shareId: undefined,
  shareToken: undefined
});

interface Emits {
  (e: 'ready'): void;
  (e: 'close'): void;
  (e: 'error', message: string): void;
  (e: 'edit', saved: boolean): void;
}

const emit = defineEmits<Emits>();

const appStore = useAppStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const { isMobile } = storeToRefs(appStore);
const { darkMode } = storeToRefs(themeStore);
const { userInfo, token } = storeToRefs(authStore);

const {
  config,
  loading: configLoading,
  error: configError,
  loadConfig,
  getApiUrl,
  getCallbackBaseUrl,
  isTokenEnabled,
  checkHealth
} = useOfficeConfig(props.shareId);

const editorId = ref(`office_editor_${Math.round(Math.random() * 10000)}`);
const rootRef = ref<HTMLElement | null>(null);
const docEditor = ref<DocEditorInstance | null>(null);
const fileInfo = ref<FileInfo | null>(null);
const isSaved = ref(true);
const isReady = ref(false);
const serviceUnavailable = ref(false);
const editorLoading = ref(false);
const editorError = ref<string | null>(null);
const hasHistoryVersion = ref(false);
const titleObserver = ref<MutationObserver | null>(null);

const historyPopoverRef = ref<InstanceType<typeof HistoryVersionPopover> | null>(null);

const fileType = computed(() => normalizeFileType(fileInfo.value?.suffix || ''));
const isDarkTheme = computed(() => darkMode.value);
const editorMode = computed(() => (props.readOnly ? 'view' : 'edit'));

const userConfig = computed(() => {
  const avatar = userInfo.value.userAvatar;
  let imageUrl: string | undefined;
  if (avatar) {
    imageUrl = avatar.startsWith('http') ? avatar : `${window.location.origin}/api/oss/thumbnail/${avatar}`;
  }
  return {
    id: userInfo.value.userId?.toString() || 'visitor',
    name: userInfo.value.userName || 'Visitor',
    image: imageUrl
  };
});

async function loadFileInfo() {
  const fileId = props.file?.id || props.fileId;
  if (!fileId) return;
  try {
    if (props.shareId) {
      const response = await fetchGetPublicFileInfoById(fileId, props.shareId);
      fileInfo.value = response.data as FileInfo;
    } else {
      const response = await fetchGetFileInfoById(fileId);
      fileInfo.value = response.data as FileInfo;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载文件信息失败';
    editorError.value = message;
    emit('error', message);
  }
}

async function checkHistoryVersions() {
  if (!fileInfo.value?.id || props.readOnly) return;
  try {
    const { data } = await fetchHistoryList(fileInfo.value.id);
    hasHistoryVersion.value = Array.isArray(data) && data.length > 0;
  } catch {
    hasHistoryVersion.value = false;
  }
}

function buildEditorConfig(): EditorConfig {
  const file = fileInfo.value!;
  const callbackBaseUrl = getCallbackBaseUrl();
  const docKey =
    props.readOnly && props.shareId
      ? generateDocumentKey(file.updateTime, props.shareId, callbackBaseUrl)
      : generateDocumentKey(file.updateTime, file.id, callbackBaseUrl);

  let docUrl: string;
  if (props.readOnly && props.shareId) {
    docUrl = getOfficeSharePreviewUrl(file.id, props.shareId, props.shareToken || 'none', file.name, callbackBaseUrl);
  } else {
    docUrl = getOfficePreviewUrl(file.id, callbackBaseUrl);
  }

  let callbackUrl: string | null = null;
  if (!props.readOnly) {
    callbackUrl = getOfficeCallbackUrl(callbackBaseUrl, file.id);
  }

  return {
    document: {
      fileType: fileType.value,
      key: docKey,
      title: file.name,
      url: docUrl
    },
    editorConfig: {
      mode: editorMode.value,
      lang: 'zh',
      user: userConfig.value,
      callbackUrl,
      customization: {
        autosave: false,
        forcesave: false,
        comments: true,
        compactHeader: false,
        compactToolbar: false,
        compatibleFeatures: false,
        help: false,
        hideRightMenu: false,
        hideRulers: false,
        submitForm: false,
        about: { visible: false },
        feedback: false,
        close: { visible: true, text: '关闭' },
        uiTheme: isDarkTheme.value ? 'default-dark' : 'default-light',
        macros: false,
        plugins: { autostart: [] }
      }
    },
    type: isMobile.value ? 'mobile' : 'desktop',
    events: {
      onAppReady: () => {
        isReady.value = true;
        emit('ready');
      },
      onDocumentReady: onDocumentReady,
      onDocumentStateChange: (event: { data: boolean }) => {
        isSaved.value = event.data;
        emit('edit', event.data);
      },
      onRequestClose: () => {
        emit('close');
      },
      onError: (event: { data: { errorCode: number; errorDescription?: string } }) => {
        // OnlyOffice 回调保存失败时 DS 会触发 onError，统一展示一条友好提示
        const code = event?.data?.errorCode;
        const desc = event?.data?.errorDescription;
        if (code === 3 || code === 4) {
          // errorCode 3=下载错误 4=保存错误，通常是权限不足
          window.$message?.error('文档保存失败：您没有编辑权限，文件以只读模式打开');
        } else if (desc) {
          window.$message?.error(`文档操作失败：${desc}`);
        }
        emit('error', desc || '文档操作失败');
      }
    }
  };
}

async function initEditor() {
  if (!config.value || !fileInfo.value) return;
  editorLoading.value = true;
  editorError.value = null;
  serviceUnavailable.value = false;
  try {
    const available = await checkHealth();
    if (!available) {
      serviceUnavailable.value = true;
      throw new Error('文档服务暂不可用');
    }
    await loadOfficeApi(getApiUrl());
    await checkHistoryVersions();

    const editorConfig = buildEditorConfig();
    if (isTokenEnabled.value) {
      if (props.shareId && props.readOnly) {
        const response = await fetchGetPublicOfficeJwt(props.shareId, props.shareToken || 'none', editorConfig);
        editorConfig.token = response.data ?? undefined;
      } else {
        const response = await fetchGetOfficeJwt(editorConfig);
        editorConfig.token = response.data ?? undefined;
      }
    }
    await nextTick();
    if (window.DocsAPI) {
      titleObserver.value = null;
      docEditor.value = new window.DocsAPI.DocEditor(editorId.value, editorConfig);
    } else {
      throw new Error('DocsAPI not available');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '初始化编辑器失败';
    editorError.value = message;
    emit('error', message);
  } finally {
    editorLoading.value = false;
  }
}

// ========== Module-level observers ==========
let uiInjectionObserver: MutationObserver | null = null;

function destroyEditor() {
  if (docEditor.value) {
    docEditor.value.destroyEditor();
    docEditor.value = null;
  }
  if (titleObserver.value) {
    titleObserver.value.disconnect();
    titleObserver.value = null;
  }
  if (uiInjectionObserver) {
    uiInjectionObserver.disconnect();
    uiInjectionObserver = null;
  }
  isReady.value = false;
}

function reloadDocument(key?: string) {
  destroyEditor();
  if (!config.value || !fileInfo.value || !window.DocsAPI) return;
  const editorConfig = buildEditorConfig();
  if (key) {
    editorConfig.document.key = key;
  }
  if (isTokenEnabled.value) {
    fetchGetOfficeJwt(editorConfig).then(response => {
      editorConfig.token = response.data ?? undefined;
      if (window.DocsAPI) {
        titleObserver.value = null;
        docEditor.value = new window.DocsAPI.DocEditor(editorId.value, editorConfig);
      }
    });
  } else if (window.DocsAPI) {
    titleObserver.value = null;
    docEditor.value = new window.DocsAPI.DocEditor(editorId.value, editorConfig);
  }
}

// ========== OnlyOffice onDocumentReady：注入自定义 UI ==========

function onDocumentReady() {
  nextTick(() => {
    waitForIframeAndInject();
  });
}

/** 收集所有可访问的 OnlyOffice iframe document（跨域 iframe 会被跳过） */
function getAllIframeDocs(): Document[] {
  const root = rootRef.value;
  if (!root) return [];
  const docs: Document[] = [];
  root.querySelectorAll('iframe').forEach(iframe => {
    try {
      const doc = iframe.contentWindow?.document;
      if (doc) docs.push(doc);
    } catch {
      // 跨域 iframe 无法访问 document，跳过
    }
  });
  return docs;
}

function getIframeDoc(): Document | null {
  if (!rootRef.value) {
    console.warn('[OfficePreview] 组件根元素未挂载');
    return null;
  }
  return getAllIframeDocs()[0] ?? null;
}

function waitForIframeAndInject() {
  // 立即尝试一次 —— 对所有可访问的 iframe 注入自定义 UI
  const docs = getAllIframeDocs();
  if (docs.length > 0) {
    docs.forEach(injectCustomUI);
    return;
  }

  const root = rootRef.value;
  if (!root) {
    console.warn('[OfficePreview] 组件根元素未挂载，无法设置 MutationObserver');
    return;
  }

  // 用 MutationObserver 等待 iframe 出现
  uiInjectionObserver?.disconnect();
  let attempt = 0;
  const maxAttempts = 20;
  uiInjectionObserver = new MutationObserver(() => {
    attempt++;
    const iframeDocs = getAllIframeDocs();
    if (iframeDocs.length > 0) {
      uiInjectionObserver?.disconnect();
      uiInjectionObserver = null;
      iframeDocs.forEach(injectCustomUI);
    } else if (attempt >= maxAttempts) {
      uiInjectionObserver?.disconnect();
      uiInjectionObserver = null;
      console.warn('[OfficePreview] 等待 iframe 超时，放弃自定义 UI 注入');
    }
  });
  uiInjectionObserver.observe(root, { childList: true, subtree: true });
}

function injectCustomUI(doc: Document) {
  // 1. 注入自定义样式 —— 隐藏左上角 logo（避免误点击跳转 OnlyOffice 官网）与 about 按钮
  injectCustomStyle(doc);

  // 2. 调整文档名称区域 padding
  const docNameBox = doc.getElementById('id-box-doc-name');
  if (docNameBox instanceof HTMLElement) {
    docNameBox.style.paddingRight = '0';
  }

  // 3. 注入历史版本按钮（仅当有历史版本时）
  if (hasHistoryVersion.value) {
    injectHistoryButton(doc);
  }
}

/**
 * 向 OnlyOffice iframe 注入一段 <style>。
 * 相比逐元素设内联 style，CSS 规则可覆盖后续异步渲染的元素，
 * 配合 !important 与多版本选择器，确保 logo 被稳定隐藏且不可点击。
 * 注意：customization.logo 配置仅商业版生效，社区版必须走此 CSS 注入。
 */
function injectCustomStyle(doc: Document) {
  const styleId = 'devops-office-custom-ui';
  if (doc.getElementById(styleId)) return; // 幂等，避免重复注入
  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* 隐藏 OnlyOffice 左上角 logo —— 覆盖多版本选择器，pointer-events 阻止点击跳转官网 */
    #header-logo,
    .asc-logo,
    a.logo,
    .extra .logo,
    #left-panel-logo,
    .header-logo,
    #box-doc-logo {
      display: none !important;
      pointer-events: none !important;
    }
    /* 隐藏 about 按钮 */
    #left-btn-about,
    #slot-btn-about {
      display: none !important;
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
}

function injectHistoryButton(doc: Document) {
  // 尝试多种选择器找到工具栏容器
  const toolbarSelectors = ['#box-doc-name', '#box-doc-name-header'];
  let toolbar: HTMLElement | null = null;
  for (const sel of toolbarSelectors) {
    const el = doc.querySelector(sel);
    if (el instanceof HTMLElement) {
      toolbar = el;
      break;
    }
  }
  if (!toolbar) {
    console.warn('[OfficePreview] 未找到 OnlyOffice 工具栏容器，无法注入历史版本按钮');
    return;
  }

  if (doc.getElementById('box-doc-name-history-btn')) return;

  toolbar.style.justifyContent = 'flex-end';
  toolbar.style.padding = '0';

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  const btn = doc.createElement('button');
  btn.classList.add('btn', 'btn-header');
  btn.id = 'box-doc-name-history-btn';
  btn.setAttribute('style', 'display:flex;align-items:center;justify-content:center;border:none;background:none;cursor:pointer;padding:4px 8px;margin-left:8px;');
  btn.innerHTML = svgIcon;
  btn.title = '历史版本';
  btn.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    historyPopoverRef.value?.toggle();
  });

  toolbar.appendChild(btn);
}

// ========== 历史版本操作 ==========

async function handleHistoryPreview(_content: string, version: any) {
  const editor = docEditor.value;
  if (!editor || !fileInfo.value) return;

  const callbackBaseUrl = getCallbackBaseUrl();
  const historyUrl = getOfficeHistoryPreviewUrl(
    callbackBaseUrl,
    version.id,
    userInfo.value.userName,
    token.value
  );

  const historyConfig = {
    fileType: fileType.value,
    key: generateDocumentKey(version.createTime || new Date().toISOString(), version.id),
    url: historyUrl,
    version: String(version.id)
  };

  try {
    const { fetchGetOfficeJwtHistory } = await import('@/service/api/disk/office');
    const response = await fetchGetOfficeJwtHistory(historyConfig);
    editor.setHistoryData({
      ...historyConfig,
      token: response.data ?? undefined
    } as any);
    injectCancelPreviewButton(version);
  } catch {
    window.$message?.error('加载历史版本失败');
  }
}

function injectCancelPreviewButton(version: any) {
  const doc = getIframeDoc();
  if (!doc) return;

  const toolbar = doc.getElementById('box-doc-name');
  if (!toolbar || doc.getElementById('box-doc-name-cancel-preview')) return;

  const cancelBtn = doc.createElement('button');
  cancelBtn.id = 'box-doc-name-cancel-preview';
  cancelBtn.classList.add('btn', 'btn-header');
  cancelBtn.innerHTML = '取消预览';
  cancelBtn.style.marginRight = '10px';
  cancelBtn.style.width = '60px';
  cancelBtn.addEventListener('click', () => {
    titleObserver.value?.disconnect();
    titleObserver.value = null;
    reloadDocument();
  });
  toolbar.prepend(cancelBtn);

  // 更新标题
  const docTitle = doc.getElementById('title-doc-name');
  if (docTitle) {
    titleObserver.value?.disconnect();
    titleObserver.value = new MutationObserver(() => {
      setTimeout(() => {
        docTitle.innerHTML = `历史版本: ${version.createTime}`;
      }, 0);
    });
    titleObserver.value.observe(docTitle, { childList: true, characterData: true });
  }
}

async function handleHistoryRestore(version: any) {
  try {
    const { error } = await fetchRestoreHistory(version.id);
    if (!error) {
      window.$message?.success('恢复成功');
      titleObserver.value?.disconnect();
      titleObserver.value = null;
      reloadDocument();
      await checkHistoryVersions();
    } else {
      window.$message?.error('恢复失败');
    }
  } catch {
    window.$message?.error('恢复失败');
  }
}

async function handleHistoryDelete(versionId: CommonType.IdType) {
  try {
    const { error } = await fetchDeleteHistory([versionId]);
    if (!error) {
      await checkHistoryVersions();
    }
  } catch {
    // popover 已处理
  }
}

function handleHistoryEmptied() {
  hasHistoryVersion.value = false;
}

// ========== watch ==========

watch(
  () => props.fileId || props.file?.id,
  async id => {
    if (!id) return;
    await loadConfig();
    await loadFileInfo();
    if (config.value && fileInfo.value) {
      await initEditor();
    }
  },
  { immediate: true }
);

watch(darkMode, () => {
  if (isReady.value) {
    reloadDocument();
  }
});

watch(hasHistoryVersion, val => {
  const doc = getIframeDoc();
  if (!doc) return;
  const btn = doc.getElementById('box-doc-name-history-btn');
  if (btn instanceof HTMLElement) {
    btn.style.display = val ? 'flex' : 'none';
  }
});

onUnmounted(() => {
  destroyEditor();
});
</script>

<template>
  <div ref="rootRef" class="office-preview-container relative w-full h-full">
    <div
      v-if="configLoading || editorLoading"
      class="absolute inset-0 flex-center bg-white/80 dark:bg-black/80 z-10"
    >
      <NSpin size="large">
        <template #description>
          <span class="text-gray-500 dark:text-gray-400">正在加载文档...</span>
        </template>
      </NSpin>
    </div>

    <div
      v-if="configError || editorError"
      class="absolute inset-0 flex-center bg-white/80 dark:bg-black/80 z-10"
    >
      <NResult :status="serviceUnavailable ? 'warning' : 'error'" :title="configError || editorError || '加载失败'">
        <template #footer>
          <NSpace>
            <NButton type="primary" @click="initEditor">重试</NButton>
            <NButton @click="emit('close')">关闭</NButton>
          </NSpace>
        </template>
      </NResult>
    </div>

    <!--
      历史版本 Popover — 使用 invisibleTrigger 模式
      不显示任何外部按钮，仅在 iframe 内注入的 SVG 图标被点击时通过 toggle() 打开
      外层 div: width/height:0 防止产生可见条，overflow:visible 允许 popover 内容溢出显示
    -->
    <div
      v-if="isReady && fileInfo && !readOnly"
      class="absolute"
      style="right: 20px; top: 61px; width: 0; height: 0; overflow: visible; z-index: 50;"
    >
      <HistoryVersionPopover
        ref="historyPopoverRef"
        :file-id="fileInfo.id"
        :emit-only="true"
        :invisible-trigger="true"
        @preview="handleHistoryPreview"
        @restore="handleHistoryRestore"
        @delete="handleHistoryDelete"
        @emptied="handleHistoryEmptied"
      />
    </div>

    <div
      :id="editorId"
      class="office-editor-placeholder w-full h-full"
      :class="{ 'opacity-0': !isReady }"
    />
  </div>
</template>

<style scoped lang="scss">
.office-preview-container {
  min-height: 400px;
}

.office-editor-placeholder {
  :deep(iframe) {
    width: 100%;
    height: 100%;
    border: none;
  }
}
</style>
