<script setup lang="ts">
import { computed, ref } from 'vue';
import { $t } from '@/locales';
import { fetchDownloadShareFile, fetchDownloadSharePackage } from '@/service/api/disk/share-public';
import { getServiceBaseURL } from '@/utils/service';
import FileIcon from '@/views/disk/modules/file-icon.vue';

defineOptions({
  name: 'ShareList'
});

interface Props {
  shortId: string;
  shareInfo: Api.Disk.SharePublicInfo | null;
  extractionCode?: string;
}

const props = defineProps<Props>();

const downloadLoading = ref(false);

// 拼接后端完整 URL 并触发浏览器下载
function triggerBrowserDownload(downloadUrl: string) {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
  const fullUrl = `${baseURL}${downloadUrl}`;

  const link = document.createElement('a');
  link.href = fullUrl;
  link.style.display = 'none';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 文件列表
const fileList = computed(() => props.shareInfo?.files ?? []);

// 是否文件夹分享
const isFolderShare = computed(() => props.shareInfo?.isFolder ?? false);

// 过期时间显示
const expireDisplay = computed(() => {
  if (!props.shareInfo?.expireDate) return $t('page.share.forever');
  const date = new Date(props.shareInfo.expireDate);
  return date.toLocaleDateString();
});

// 格式化文件大小
function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// 下载单个文件
async function handleDownloadFile(item: Api.Disk.ShareFileItem) {
  if (item.isFolder) {
    window.$message?.info($t('page.share.folderDownloadTip'));
    return;
  }

  downloadLoading.value = true;
  const { data, error } = await fetchDownloadShareFile(props.shortId, item.fileId, props.extractionCode);
  downloadLoading.value = false;

  if (!error && data?.downloadUrl) {
    triggerBrowserDownload(data.downloadUrl);
  }
}

// 打包下载全部
async function handleDownloadPackage() {
  downloadLoading.value = true;
  const { data, error } = await fetchDownloadSharePackage(props.shortId, props.extractionCode);
  downloadLoading.value = false;

  if (!error && data?.downloadUrl) {
    triggerBrowserDownload(data.downloadUrl);
  }
}

// 双击文件提示
function handleDoubleClick(item: Api.Disk.ShareFileItem) {
  if (!item.isFolder) {
    window.$message?.info($t('page.share.previewNotAllowed'));
  }
}
</script>

<template>
  <div class="w-full max-w-600px flex flex-col gap-16px">
    <!-- 分享信息头部 -->
    <div v-if="shareInfo" class="p-16px rounded bg-white dark:bg-gray-800 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-12px min-w-0 flex-1">
          <FileIcon
            :file-type="shareInfo.fileType"
            :extension="shareInfo.fileExtension"
            size="medium"
          />
          <div class="min-w-0 flex-1">
            <div class="text-16px font-medium truncate">{{ shareInfo.fileName }}</div>
            <div class="text-12px opacity-60">
              {{ $t('page.share.sharer') }}: {{ shareInfo.sharerName }} · {{ $t('page.share.expire') }}: {{ expireDisplay }}
            </div>
          </div>
        </div>
        <!-- 统计信息 -->
        <div class="text-12px opacity-50 text-right">
          <div>{{ $t('page.share.viewCount') }}: {{ shareInfo.viewCount }}</div>
          <div>{{ $t('page.share.downloadCount') }}: {{ shareInfo.downloadCount }}</div>
        </div>
      </div>
    </div>

    <!-- 提示条 -->
    <div class="px-12px py-8px rounded bg-warning/10 text-warning text-13px">
      <SvgIcon icon="mdi:information-outline" :size="16" class="mr-4px" />
      {{ $t('page.share.previewNotAllowedTip') }}
    </div>

    <!-- 文件列表 -->
    <div class="rounded bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div v-if="fileList.length === 0" class="py-48px text-center opacity-50">
        {{ $t('page.share.noFiles') }}
      </div>
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="item in fileList"
          :key="item.fileId"
          class="flex items-center gap-12px px-16px py-12px cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          @dblclick="handleDoubleClick(item)"
        >
          <FileIcon
            :file-type="item.fileType"
            :extension="item.fileExtension"
            size="medium"
          />
          <div class="min-w-0 flex-1">
            <div class="text-14px truncate">{{ item.fileName }}</div>
            <div class="text-12px opacity-50">
              {{ item.isFolder ? $t('page.share.folder') : formatFileSize(item.fileSize) }}
            </div>
          </div>
          <!-- 下载按钮 -->
          <NButton
            v-if="!item.isFolder"
            quaternary
            size="small"
            :loading="downloadLoading"
            @click.stop="handleDownloadFile(item)"
          >
            <template #icon>
              <SvgIcon icon="mdi:download" :size="18" />
            </template>
          </NButton>
        </div>
      </div>
    </div>

    <!-- 打包下载 -->
    <div v-if="isFolderShare && fileList.length > 0" class="flex justify-center">
      <NButton type="primary" :loading="downloadLoading" @click="handleDownloadPackage">
        <template #icon>
          <SvgIcon icon="mdi:download" :size="18" />
        </template>
        {{ $t('page.share.downloadAll') }}
      </NButton>
    </div>
  </div>
</template>
