import { ref, computed, nextTick } from 'vue';
import type { Ref } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchGenerateStreamToken } from '@/service/api/disk';
import { getPreviewCategory } from '@/utils/file-type';
import { getServiceBaseURL } from '@/utils/service';
import ImagePreview from '@/components/preview/image-preview.vue';

interface UseFilePreviewOptions {
  fileList: Ref<Api.Disk.FileItem[]>;
  imagePreviewRef: Ref<InstanceType<typeof ImagePreview> | undefined>;
  audioFilterMode?: 'fileType' | 'previewCategory';
}

export function useFilePreview(options: UseFilePreviewOptions) {
  const { fileList, imagePreviewRef, audioFilterMode = 'previewCategory' } = options;
  const diskStore = useDiskStore();

  // --- State ---
  const videoPreviewFile = ref<Api.Disk.FileItem | null>(null);
  const videoPreviewVisible = ref(false);
  const videoStreamToken = ref('');

  const audioPreviewFile = ref<Api.Disk.FileItem | null>(null);
  const audioPreviewVisible = ref(false);
  const isAudioCompact = ref(false);

  const previewVisible = ref(false);
  const previewFile = ref<Api.Disk.PreviewFileInfo | null>(null);

  const archiveFile = ref<Api.Disk.FileItem | null>(null);
  const showArchiveAction = ref(false);
  const showArchivePreview = ref(false);

  // --- Computed ---
  const audioPlaylist = computed(() => {
    const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
    const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

    const filterFn = audioFilterMode === 'fileType'
      ? (f: Api.Disk.FileItem) => f.fileType === 'audio' && !f.isFolder
      : (f: Api.Disk.FileItem) => !f.isFolder && !f.isDir && getPreviewCategory(f.fileName || f.name || '') === 'audio';

    return fileList.value.filter(filterFn).map(file => ({
      id: file.fileId,
      title: file.music?.songName || (file.fileName || file.name || '').replace(/\.[^.]+$/, ''),
      artist: file.music?.singer || $t('page.disk.sharedWithMe.unknownArtist'),
      album: file.music?.album || '',
      cover: file.mediaCover ? `${baseURL}/view/cover?id=${file.fileId}` : '',
      src: `${baseURL}/preview/file/${file.fileId}`,
      duration: undefined,
      lyrics: undefined
    }));
  });

  const currentAudioIndex = computed(() => {
    if (!audioPreviewFile.value) return 0;
    return audioPlaylist.value.findIndex(item => String(item.id) === String(audioPreviewFile.value?.fileId));
  });

  const videoStreamBaseUrl = computed(() => {
    const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
    const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
    return `${baseURL}/stream/video/${videoPreviewFile.value?.fileId}`;
  });

  // --- Video ---
  async function openVideoPreview(file: Api.Disk.FileItem) {
    if (videoPreviewVisible.value) {
      window.$message?.info($t('page.disk.sharedWithMe.closeCurrentVideo'));
      return;
    }
    const res = await fetchGenerateStreamToken(String(file.fileId));
    if (res.data) {
      videoStreamToken.value = res.data.token;
      videoPreviewFile.value = file;
      videoPreviewVisible.value = true;
    }
  }

  function closeVideoPreview() {
    videoPreviewVisible.value = false;
    videoPreviewFile.value = null;
    videoStreamToken.value = '';
  }

  function handleVideoTokenUpdate(token: string) {
    videoStreamToken.value = token;
  }

  // --- Audio ---
  function openAudioPreview(file: Api.Disk.FileItem) {
    audioPreviewFile.value = file;
    audioPreviewVisible.value = true;
  }

  function closeAudioPreview() {
    audioPreviewVisible.value = false;
    audioPreviewFile.value = null;
    isAudioCompact.value = false;
  }

  function handleAudioOverlayClick() {
    if (!isAudioCompact.value) {
      audioPreviewVisible.value = false;
      audioPreviewFile.value = null;
    }
  }

  // --- Image ---
  function openImagePreview(file: Api.Disk.FileItem) {
    const images = fileList.value
      .filter(f => !f.isFolder && getPreviewCategory(f.fileName || f.name || '') === 'image')
      .map(f => ({ fileId: f.fileId, fileName: f.fileName || f.name || '' }));
    const initialIndex = images.findIndex(img => String(img.fileId) === String(file.fileId));
    nextTick(() => {
      imagePreviewRef.value?.show(images, initialIndex >= 0 ? initialIndex : 0);
    });
  }

  function openFolderImagePreview(file: Api.Disk.FileItem, folderFiles: Api.Disk.FileItem[]) {
    const images = folderFiles
      .filter(f => !f.isDir && getPreviewCategory(f.fileName || f.name || '') === 'image')
      .map(f => ({ fileId: f.fileId, fileName: f.fileName || f.name || '' }));
    const initialIndex = images.findIndex(img => String(img.fileId) === String(file.fileId));
    nextTick(() => {
      imagePreviewRef.value?.show(images, initialIndex >= 0 ? initialIndex : 0);
    });
  }

  // --- Office/PDF ---
  function openOfficePdfPreview(file: Api.Disk.FileItem) {
    previewFile.value = {
      fileId: file.fileId,
      fileName: file.fileName || file.name || '',
      fileSize: file.fileSize || file.size || 0,
      fileExtension: file.fileExtension || file.extendName,
      filePath: file.filePath
    };
    previewVisible.value = true;
  }

  // --- Text/Code ---
  function openTextPreview(file: Api.Disk.FileItem) {
    diskStore.textPreviewRow = file;
    diskStore.textPreviewVisible = true;
  }

  // --- Unified preview dispatch ---
  function previewByCategory(file: Api.Disk.FileItem, opts?: { folderFiles?: Api.Disk.FileItem[] }) {
    const category = getPreviewCategory(file.fileName || file.name || '');
    switch (category) {
      case 'image':
        if (opts?.folderFiles) openFolderImagePreview(file, opts.folderFiles);
        else openImagePreview(file);
        break;
      case 'video':
        openVideoPreview(file);
        break;
      case 'audio':
        openAudioPreview(file);
        break;
      case 'office':
      case 'pdf':
        openOfficePdfPreview(file);
        break;
      case 'code':
      case 'markdown':
        openTextPreview(file);
        break;
      case 'archive':
        archiveFile.value = file;
        showArchiveAction.value = true;
        break;
      default:
        window.$notification?.warning({ content: $t('page.disk.sharedWithMe.previewNotSupported'), duration: 3000 });
    }
  }

  return {
    // State
    videoPreviewFile,
    videoPreviewVisible,
    videoStreamToken,
    videoStreamBaseUrl,
    audioPreviewFile,
    audioPreviewVisible,
    audioPlaylist,
    currentAudioIndex,
    isAudioCompact,
    previewVisible,
    previewFile,
    // Functions
    openVideoPreview,
    closeVideoPreview,
    handleVideoTokenUpdate,
    openAudioPreview,
    closeAudioPreview,
    handleAudioOverlayClick,
    openImagePreview,
    openFolderImagePreview,
    openOfficePdfPreview,
    openTextPreview,
    previewByCategory,
    archiveFile,
    showArchiveAction,
    showArchivePreview
  };
}
