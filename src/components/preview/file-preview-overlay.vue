<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { getPreviewCategory, getMonacoLanguage } from '@/utils/file-type';
import { getServiceBaseURL } from '@/utils/service';
import { useAppStore } from '@/store/modules/app';
import OfficePreview from './office-preview.vue';
import PdfPreview from './pdf-preview.vue';
import ImagePreview from './image-preview.vue';
import VideoPreview from './video-preview.vue';
import AudioPreview from './audio-preview.vue';
import MonacoEditor from './monaco-editor.vue';
import VditorEditor from './vditor-editor.vue';

defineOptions({
  name: 'FilePreviewOverlay'
});

interface Props {
  visible: boolean;
  file?: Api.Disk.PreviewFileInfo | null;
  /** 同目录下的文件列表（用于图片轮播、音频播放列表等） */
  fileList?: Api.Disk.FileItem[];
  /** 只读模式（共享查看者无编辑权限） */
  readOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  file: null,
  fileList: () => [],
  readOnly: false
});

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

const appStore = useAppStore();
const { isMobile } = storeToRefs(appStore);

const showOverlay = computed(() => props.visible && props.file);

const previewCategory = computed(() => {
  if (!props.file?.fileName) return 'unknown';
  return getPreviewCategory(props.file.fileName);
});

const loading = ref(true);

// 代码/Markdown 内容
const codeContent = ref('');
const codeLoading = ref(false);

// 媒体播放状态
const streamToken = ref('');
const showVideoPreview = ref(false);
const showAudioPreview = ref(false);
const audioPlaylist = ref<AudioPreviewPlaylistItem[]>([]);
const audioInitialIndex = ref(0);
const audioCompactMode = ref(false);

// 图片预览实例引用
const imagePreviewRef = ref<InstanceType<typeof ImagePreview> | null>(null);

// 构建预览 URL
const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

interface AudioPreviewPlaylistItem {
  id: string | number;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  src: string;
  lyrics?: string;
}

// 构建媒体 URL
function buildMediaUrl(fileId: CommonType.IdType): string {
  return `${baseURL}/preview/file/${fileId}`;
}

// 加载文本/代码文件内容
async function loadTextContent() {
  if (!props.file?.fileId) return;

  codeLoading.value = true;
  try {
    const url = `${baseURL}/preview/text/stream?fileId=${props.file.fileId}&t=${new Date().getTime()}`;
    const response = await fetch(url, { method: 'GET', credentials: 'include' });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder('utf-8');
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    codeContent.value = result;
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : '加载文件失败');
  } finally {
    codeLoading.value = false;
  }
}

// 初始化预览
async function initPreview() {
  loading.value = true;
  codeContent.value = '';
  showVideoPreview.value = false;
  showAudioPreview.value = false;
  audioPlaylist.value = [];

  const category = previewCategory.value;

  switch (category) {
    case 'office':
    case 'pdf':
      // Office 和 PDF 由各自组件处理 loading
      break;

    case 'image':
      loading.value = false;
      // 图片预览使用 ImagePreview 组件的 show 方法
      initImagePreview();
      break;

    case 'video':
      await initVideoPreview();
      break;

    case 'audio':
      await initAudioPreview();
      break;

    case 'code':
      await loadTextContent();
      loading.value = false;
      break;

    case 'markdown':
      await loadTextContent();
      loading.value = false;
      break;

    default:
      loading.value = false;
      window.$message?.warning('该文件类型不支持预览');
  }
}

// 初始化图片预览
function initImagePreview() {
  if (!props.file || !imagePreviewRef.value) return;

  // 构建同目录下的图片列表用于轮播
  const images: { fileId: CommonType.IdType; fileName: string }[] = [];

  if (props.fileList.length > 0) {
    // 从 fileList 中筛选图片
    props.fileList.forEach(item => {
      const cat = getPreviewCategory(item.fileName);
      if (cat === 'image') {
        images.push({
          fileId: item.fileId,
          fileName: item.fileName
        });
      }
    });
  }

  // 如果 fileList 中没有图片或只有当前文件，只预览当前
  if (images.length === 0) {
    images.push({
      fileId: props.file.fileId!,
      fileName: props.file.fileName
    });
  }

  // 找到当前图片的索引
  const currentIndex = images.findIndex(img => img.fileId === props.file?.fileId);

  imagePreviewRef.value.show(images, currentIndex >= 0 ? currentIndex : 0);
}

// 初始化视频预览
async function initVideoPreview() {
  if (!props.file?.fileId) return;

  try {
    // 生成流媒体 token
    const { fetchGenerateStreamToken } = await import('@/service/api/disk/file');
    const response = await fetchGenerateStreamToken(String(props.file.fileId));
    if (response.data) {
      streamToken.value = response.data.token;
      showVideoPreview.value = true;
    }
  } catch {
    window.$message?.error('视频加载失败');
  } finally {
    loading.value = false;
  }
}

// 初始化音频预览
async function initAudioPreview() {
  if (!props.file?.fileId) return;

  try {
    // 构建播放列表（同目录下的所有音频）
    const playlist: AudioPreviewPlaylistItem[] = [];

    if (props.fileList.length > 0) {
      props.fileList.forEach(item => {
        const cat = getPreviewCategory(item.fileName);
        if (cat === 'audio') {
          playlist.push({
            id: item.fileId,
            title: item.fileName.replace(/\.[^/.]+$/, ''), // 去掉扩展名
            artist: item.music?.singer || '未知艺术家',
            album: item.music?.album,
            // 使用 coverBase64 作为封面（如果有）
            cover: item.music?.coverBase64 ? `data:image/jpeg;base64,${item.music.coverBase64}` : undefined,
            src: buildMediaUrl(item.fileId),
            lyrics: undefined // MusicInfo 类型不支持 lyrics
          });
        }
      });
    }

    // 如果没有播放列表，只播放当前文件
    if (playlist.length === 0) {
      playlist.push({
        id: props.file.fileId,
        title: props.file.fileName.replace(/\.[^/.]+$/, ''),
        artist: '未知艺术家',
        src: buildMediaUrl(props.file.fileId)
      });
    }

    audioPlaylist.value = playlist;
    audioInitialIndex.value = playlist.findIndex(item => item.id === props.file?.fileId);
    if (audioInitialIndex.value < 0) audioInitialIndex.value = 0;

    // 移动端默认使用精简模式
    audioCompactMode.value = isMobile.value;

    showAudioPreview.value = true;
  } finally {
    loading.value = false;
  }
}

// 处理视频 token 更新
async function handleVideoTokenUpdate(newToken: string) {
  streamToken.value = newToken;
}

// 处理音频精简模式变化
function handleAudioCompactChange(isCompact: boolean) {
  audioCompactMode.value = isCompact;
}

function handlePdfReady() {
  loading.value = false;
}

function handleOfficeReady() {
  loading.value = false;
}

function handleOfficeError(message: string) {
  loading.value = false;
  window.$message?.error(message);
}

function beforeClose() {
  // 关闭各预览组件
  showVideoPreview.value = false;
  showAudioPreview.value = false;

  close();
}

function close() {
  loading.value = true;
  codeContent.value = '';
  emit('update:visible', false);
  emit('close');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    beforeClose();
  }
}

// 监听文件变化初始化预览
watch(showOverlay, show => {
  if (show) {
    initPreview();
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <!-- 图片预览 - 使用 v-viewer 全屏模式 -->
    <ImagePreview ref="imagePreviewRef" />

    <!-- 视频预览 - 全屏播放器 -->
    <VideoPreview
      v-if="showVideoPreview && previewCategory === 'video'"
      :src="`${baseURL}/preview/file/${file?.fileId}`"
      :stream-token="streamToken"
      @close="beforeClose"
      @token-update="handleVideoTokenUpdate"
    />

    <!-- 音频预览 - 精简/完整播放器 -->
    <AudioPreview
      v-if="showAudioPreview && previewCategory === 'audio'"
      :playlist="audioPlaylist"
      :initial-index="audioInitialIndex"
      :auto-play="true"
      @close="beforeClose"
      @compact-change="handleAudioCompactChange"
    />

    <!-- 代码/Markdown 预览 - 全屏遮罩层 -->
    <div
      v-if="showOverlay && (previewCategory === 'code' || previewCategory === 'markdown' || previewCategory === 'office' || previewCategory === 'pdf')"
      class="fixed inset-0 z-1002 bg-black/70"
    >
      <!-- Loading -->
      <div
        v-if="loading && (previewCategory === 'office' || previewCategory === 'pdf')"
        class="absolute inset-0 flex-center z-10"
      >
        <NSpin size="large">
          <template #description>
            <span class="text-gray-300">正在加载文档...</span>
          </template>
        </NSpin>
      </div>

      <!-- Loading for code/markdown -->
      <div
        v-if="codeLoading && (previewCategory === 'code' || previewCategory === 'markdown')"
        class="absolute inset-0 flex-center z-10"
      >
        <NSpin size="large">
          <template #description>
            <span class="text-gray-300">正在加载内容...</span>
          </template>
        </NSpin>
      </div>

      <!-- Close button -->
      <div
        v-if="previewCategory !== 'office'"
        class="absolute top-0 right-0 z-2003 flex-center p-8px"
      >
        <NButton
          quaternary
          circle
          size="small"
          class="text-white/80 hover:text-white hover:bg-white/20"
          @click="beforeClose"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </template>
        </NButton>
      </div>

      <!-- Editor area - full screen -->
      <div class="w-full h-full">
        <!-- Office 文档 -->
        <OfficePreview
          v-if="previewCategory === 'office'"
          :file-id="file?.fileId"
          :read-only="readOnly"
          @ready="handleOfficeReady"
          @close="beforeClose"
          @error="handleOfficeError"
        />

        <!-- PDF 文档 -->
        <PdfPreview
          v-else-if="previewCategory === 'pdf'"
          :file-id="file?.fileId"
          @ready="handlePdfReady"
          @close="beforeClose"
        />

        <!-- Markdown 编辑器 -->
        <div
          v-else-if="previewCategory === 'markdown' && !codeLoading"
          class="w-full h-full bg-white dark:bg-[#1e1e1e]"
        >
          <VditorEditor
            v-model="codeContent"
            class="h-full"
          />
        </div>

        <!-- 代码编辑器 -->
        <div
          v-else-if="previewCategory === 'code' && !codeLoading"
          class="w-full h-full bg-white dark:bg-[#1e1e1e]"
        >
          <MonacoEditor
            v-model="codeContent"
            :language="getMonacoLanguage(file?.fileName || '')"
            :read-only="true"
            class="h-full"
          />
        </div>

        <!-- 加载中兜底 -->
        <div v-else class="flex-center h-full">
          <NSpin size="large">
            <template #description>
              <span class="text-gray-300">加载中...</span>
            </template>
          </NSpin>
        </div>
      </div>
    </div>

    <!-- 不支持预览的文件类型提示 -->
    <NDialog
      v-if="showOverlay && previewCategory === 'unknown'"
      v-model:show="showOverlay"
      preset="dialog"
      title="无法预览"
      content="该文件类型不支持在线预览，请下载后查看"
      positive-text="关闭"
      type="info"
      z-index="2000"
      @positive-click="close"
    />
  </Teleport>
</template>
