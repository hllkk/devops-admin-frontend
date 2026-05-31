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
import { useOfficeConfig } from '@/hooks/business/use-office-config';
import { useOfficeEvents } from '@/hooks/business/use-office-events';
import {
  getOfficePreviewUrl,
  getOfficeSharePreviewUrl,
  getOfficeCallbackUrl,
  generateDocumentKey,
  normalizeFileType,
  loadOfficeApi
} from '@/utils/office-config';
import type { EditorConfig, DocEditorInstance } from '@/types/office';

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
const docEditor = ref<DocEditorInstance | null>(null);
const fileInfo = ref<FileInfo | null>(null);
const isSaved = ref(true);
const isReady = ref(false);
const serviceUnavailable = ref(false);
const editorLoading = ref(false);
const editorError = ref<string | null>(null);

const fileType = computed(() => normalizeFileType(fileInfo.value?.suffix || ''));
const isDarkTheme = computed(() => darkMode.value);
const editorMode = computed(() => (props.readOnly ? 'view' : 'edit'));

const userConfig = computed(() => ({
  id: userInfo.value.userId?.toString() || 'visitor',
  name: userInfo.value.userName || 'Visitor',
  image: userInfo.value.userAvatar
    ? `${window.location.origin}/api/public/s/view/thumbnail?id=${userInfo.value.userAvatar}`
    : undefined
}));

const {
  handleAppReady,
  handleDocumentReady,
  handleDocumentStateChange,
  handleRequestHistory,
  handleRequestHistoryData,
  handleRequestHistoryClose,
  handleRequestClose
} = useOfficeEvents({
  docEditor: () => docEditor.value,
  fileId: props.file?.id || props.fileId || 0,
  token: token.value,
  username: userInfo.value.userName,
  isSaved,
  isReady,
  fileType: () => fileType.value,
  reloadDocument,
  onClose: () => emit('close'),
  onReady: () => {
    isReady.value = true;
    emit('ready');
  }
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
        about: null,
        feedback: false,
        close: { visible: true, text: '关闭' },
        uiTheme: isDarkTheme.value ? 'default-dark' : 'default-light',
        macros: false,
        plugins: { autostart: [] }
      }
    },
    type: isMobile.value ? 'mobile' : 'desktop',
    events: {
      onAppReady: handleAppReady,
      onDocumentReady: handleDocumentReady,
      onDocumentStateChange: handleDocumentStateChange,
      onRequestHistory: handleRequestHistory,
      onRequestHistoryData: handleRequestHistoryData,
      onRequestHistoryClose: handleRequestHistoryClose,
      onRequestClose: handleRequestClose
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

function destroyEditor() {
  if (docEditor.value) {
    docEditor.value.destroyEditor();
    docEditor.value = null;
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
        docEditor.value = new window.DocsAPI.DocEditor(editorId.value, editorConfig);
      }
    });
  } else if (window.DocsAPI) {
    docEditor.value = new window.DocsAPI.DocEditor(editorId.value, editorConfig);
  }
}

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

onUnmounted(() => {
  destroyEditor();
});
</script>

<template>
  <div class="office-preview-container relative w-full h-full">
    <div
      v-if="configLoading || editorLoading"
      class="absolute inset-0 flex-center bg-white/80 dark:bg-black/80"
    >
      <NSpin size="large">
        <template #description>
          <span class="text-gray-500 dark:text-gray-400">正在加载文档...</span>
        </template>
      </NSpin>
    </div>

    <div
      v-if="configError || editorError"
      class="absolute inset-0 flex-center bg-white/80 dark:bg-black/80"
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
