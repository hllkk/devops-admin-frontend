<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import { useDiskStore } from '@/store/modules/disk';
import { useAppStore } from '@/store/modules/app';
import FileIcon from './file-icon.vue';
import { formatFileSize } from '@/utils/format';
import { useUploader } from '@/hooks/business/upload/use-uploader';

/** 懒加载 ECharts 及 liquidfill 插件，仅在球体视图需要时加载 */
let echartsModule: typeof import('echarts') | null = null;
let echartsLoading: Promise<typeof import('echarts')> | null = null;

async function loadEcharts() {
  if (echartsModule) return echartsModule;
  if (echartsLoading) return echartsLoading;
  echartsLoading = import('echarts').then(async (mod) => {
    await import('echarts-liquidfill');
    echartsModule = mod;
    return mod;
  });
  return echartsLoading;
}

defineOptions({
  name: 'TransferPanel'
});

const diskStore = useDiskStore();
const appStore = useAppStore();
const { pause, resume, cancel, retry, pauseAll, resumeAll } = useUploader();

const isVisible = ref(false);
// PC端默认list，手机端默认sphere
const viewMode = ref<'list' | 'sphere'>(appStore.isMobile ? 'sphere' : 'list');
const liquidfillChart = ref<ReturnType<typeof import('echarts')['init']> | null>(null);
const chartContainerRef = ref<HTMLDivElement | null>(null);

const activeTransfers = computed(() =>
  diskStore.transferList.filter(item => item.status !== 'completed')
);

const hasActiveTransfers = computed(() => activeTransfers.value.length > 0);

const allCompleted = computed(() => {
  const items = diskStore.transferList;
  return items.length > 0 && items.every(item => item.status === 'completed');
});

const isEmpty = computed(() => diskStore.transferList.length === 0);

const overallProgress = computed(() => {
  const items = diskStore.transferList;
  if (items.length === 0) return 0;

  // 计算所有未完成文件的平均进度（包括 pending 和 transferring）
  const activeItems = items.filter(item => item.status !== 'completed');
  if (activeItems.length === 0) return 100; // 全部完成时显示 100%

  const total = activeItems.reduce((sum, item) => sum + item.progress, 0);
  return Math.round(total / activeItems.length);
});

// 初始化 ECharts liquidfill 图表（懒加载）
async function initLiquidfillChart() {
  if (!chartContainerRef.value) return;

  const echarts = await loadEcharts();

  liquidfillChart.value = echarts.init(chartContainerRef.value);

  const progress = overallProgress.value / 100;
  const isCompleted = allCompleted.value;

  const option = {
    series: [{
      type: 'liquidFill',
      radius: '85%',
      center: ['50%', '50%'],
      // 完成时使用静态值 1，不完成时用动态波浪
      data: isCompleted ? [1] : [progress, progress - 0.02, progress - 0.04],
      backgroundStyle: {
        color: isCompleted ? 'rgba(82, 196, 26, 0.15)' : 'rgba(100, 108, 255, 0.08)'
      },
      outline: {
        show: false
      },
      shape: 'circle',
      color: isCompleted ? ['rgba(82, 196, 26, 0.7)'] : [
        'rgba(100, 108, 255, 0.6)',
        'rgba(100, 108, 255, 0.5)',
        'rgba(100, 108, 255, 0.4)'
      ],
      // 完成时停止波浪动画
      amplitude: isCompleted ? 0 : 8,
      waveAnimation: !isCompleted,
      animationDuration: isCompleted ? 0 : 3000,
      animationDurationUpdate: isCompleted ? 0 : 300,
      itemStyle: {
        opacity: 0.85
      },
      emphasis: {
        itemStyle: {
          opacity: 0.9
        }
      },
      label: {
        show: false
      }
    }]
  };

  liquidfillChart.value.setOption(option);
}

// 更新图表数据
function updateChartProgress() {
  if (!liquidfillChart.value) return;

  const progress = overallProgress.value / 100;
  const isCompleted = allCompleted.value;

  liquidfillChart.value.setOption({
    series: [{
      // 完成时使用静态值 1，不完成时用动态波浪
      data: isCompleted ? [1] : [progress, progress - 0.02, progress - 0.04],
      backgroundStyle: {
        color: isCompleted ? 'rgba(82, 196, 26, 0.15)' : 'rgba(100, 108, 255, 0.08)'
      },
      color: isCompleted ? ['rgba(82, 196, 26, 0.7)'] : [
        'rgba(100, 108, 255, 0.6)',
        'rgba(100, 108, 255, 0.5)',
        'rgba(100, 108, 255, 0.4)'
      ],
      // 完成时停止波浪动画
      amplitude: isCompleted ? 0 : 8,
      waveAnimation: !isCompleted,
      animationDuration: isCompleted ? 0 : 3000,
      animationDurationUpdate: isCompleted ? 0 : 300
    }]
  });
}

const totalSpeed = computed(() => {
  const items = activeTransfers.value.filter(item => item.status === 'transferring');
  return items.reduce((sum, item) => sum + item.speed, 0);
});

const activeCount = computed(() => activeTransfers.value.length);

function showSphere() {
  isVisible.value = true;
  viewMode.value = 'sphere';
}

function showList() {
  isVisible.value = true;
  // 手机端不允许打开list视图，强制使用sphere
  viewMode.value = appStore.isMobile ? 'sphere' : 'list';
}

// 根据设备类型显示默认视图（PC端list，手机端sphere）
function showDefault() {
  isVisible.value = true;
  viewMode.value = appStore.isMobile ? 'sphere' : 'list';
}

function closePanel() {
  isVisible.value = false;
  // 销毁图表实例，防止DOM移除后实例失效
  if (liquidfillChart.value) {
    liquidfillChart.value.dispose();
    liquidfillChart.value = null;
  }
}

// 新上传开始时自动展示传输面板
watch(() => diskStore.uploadingCount, (newCount, oldCount) => {
  if (newCount > oldCount && !isVisible.value) {
    showDefault();
  }
});

function switchToSphere() {
  viewMode.value = 'sphere';
}

function switchToList() {
  // 手机端不允许切换到list视图
  if (appStore.isMobile) return;
  // 切换到list时销毁sphere的图表实例
  if (liquidfillChart.value) {
    liquidfillChart.value.dispose();
    liquidfillChart.value = null;
  }
  viewMode.value = 'list';
}

function cancelTransfer(transferId: string) {
  cancel(transferId);
}

function getStatusColor(status: Api.Disk.TransferItem['status']) {
  const map: Record<string, string> = {
    pending: '#999',
    hashing: '#f0a020',
    checking: '#f0a020',
    uploading: 'rgb(var(--primary-color))',
    transferring: 'rgb(var(--primary-color))',
    merging: 'rgb(var(--primary-color))',
    completed: 'rgb(var(--n-success-color))',
    failed: 'rgb(var(--n-error-color))',
    paused: '#999'
  };
  return map[status] || 'rgb(var(--primary-color))';
}

function getStatusText(item: Api.Disk.TransferItem): string {
  if (item.status === 'hashing') return '计算文件特征中...';
  if (item.status === 'checking') return '检测秒传...';
  if (item.status === 'merging') return '合并分片中...';
  if (item.status === 'paused') return '已暂停';
  if (item.status === 'pending') return '等待中';
  if (item.status === 'failed') return item.error || '上传失败';
  return '';
}

function isActiveStatus(status: Api.Disk.TransferItem['status']): boolean {
  return ['uploading', 'hashing', 'checking', 'merging', 'transferring'].includes(status);
}

function isPreparingStatus(status: Api.Disk.TransferItem['status']): boolean {
  return ['hashing', 'checking'].includes(status);
}

function getFileTypeCategory(extension: string): string {
  if (!extension) return 'other';
  const extToCategory: Record<string, string> = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
    pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document', csv: 'document',
    ppt: 'document', pptx: 'document', txt: 'document', md: 'document', log: 'document',
    mp4: 'video', avi: 'video', mov: 'video', mkv: 'video', wmv: 'video', flv: 'video',
    mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio', wma: 'audio'
  };
  return extToCategory[extension.toLowerCase()] || 'other';
}

// ---- Folder grouping ----
const expandedFolders = ref<Set<string>>(new Set());
const expandedDetails = ref<Set<string>>(new Set());

const folderGroups = computed(() => {
  const groups = new Map<string, { name: string; items: Api.Disk.TransferItem[] }>();
  for (const item of activeTransfers.value) {
    if (item.folderId) {
      let group = groups.get(item.folderId);
      if (!group) {
        group = { name: item.folderName || '文件夹', items: [] };
        groups.set(item.folderId, group);
      }
      group.items.push(item);
    }
  }
  return groups;
});

const ungroupedItems = computed(() =>
  activeTransfers.value.filter(item => !item.folderId)
);

function toggleFolder(folderId: string) {
  const set = new Set(expandedFolders.value);
  if (set.has(folderId)) {
    set.delete(folderId);
  } else {
    set.add(folderId);
  }
  expandedFolders.value = set;
}

function toggleDetail(transferId: string) {
  const set = new Set(expandedDetails.value);
  if (set.has(transferId)) {
    set.delete(transferId);
  } else {
    set.add(transferId);
  }
  expandedDetails.value = set;
}

function getFolderProgress(items: Api.Disk.TransferItem[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.progress, 0);
  return Math.round(total / items.length);
}

function getFolderStatus(items: Api.Disk.TransferItem[]): Api.Disk.TransferItem['status'] {
  if (items.every(i => i.status === 'completed')) return 'completed';
  if (items.every(i => i.status === 'paused')) return 'paused';
  if (items.some(i => i.status === 'failed')) return 'failed';
  return 'transferring';
}

function cancelFolder(folderId: string) {
  const items = folderGroups.value.get(folderId)?.items;
  if (!items) return;
  for (const item of items) {
    cancel(item.transferId);
  }
}

function pauseFolder(folderId: string) {
  const items = folderGroups.value.get(folderId)?.items;
  if (!items) return;
  for (const item of items) {
    if (isActiveStatus(item.status)) pause(item.transferId);
  }
}

function resumeFolder(folderId: string) {
  const items = folderGroups.value.get(folderId)?.items;
  if (!items) return;
  for (const item of items) {
    if (item.status === 'paused') resume(item.transferId);
  }
}

defineExpose({ showSphere, showList, showDefault });

// 监听进度变化更新图表
watch(overallProgress, () => {
  nextTick(() => {
    updateChartProgress();
  });
});

watch(allCompleted, () => {
  nextTick(() => {
    updateChartProgress();
  });
});

// 监听屏幕大小变化，手机端自动切换到sphere视图
watch(
  () => appStore.isMobile,
  (isMobile) => {
    if (isMobile && viewMode.value === 'list') {
      viewMode.value = 'sphere';
    }
  }
);

// 监听传输列表变化，在有任务时初始化图表
watch([isEmpty, isVisible, viewMode], ([empty, visible, mode]) => {
  if (!empty && visible && mode === 'sphere') {
    // 延迟初始化，确保Transition动画完成后DOM已渲染
    // out-in模式：leave(200ms) + buffer = 需等待至少250ms
    nextTick(() => {
      setTimeout(() => {
        if (!liquidfillChart.value && chartContainerRef.value) {
          initLiquidfillChart();
        } else if (liquidfillChart.value) {
          updateChartProgress();
        }
      }, 300);
    });
  }
});

onMounted(() => {
  if (hasActiveTransfers.value) {
    isVisible.value = true;
    // PC端默认list，手机端默认sphere
    viewMode.value = appStore.isMobile ? 'sphere' : 'list';
  }
  // 延迟初始化，确保DOM渲染完成
  nextTick(() => {
    setTimeout(() => {
      if (!isEmpty.value && chartContainerRef.value && viewMode.value === 'sphere') {
        initLiquidfillChart();
      }
    }, 300);
  });
});
</script>

<template>
  <div class="fixed right-20px bottom-20px z-1000 flex flex-col items-end gap-8px sm:right-20px sm:bottom-20px lt-sm:right-10px lt-sm:bottom-10px">
    <!-- Unified transition with out-in mode for smooth switching -->
    <Transition name="view-switch" mode="out-in">
      <div
        v-if="isVisible && viewMode === 'list'" key="list"
        class="w-560px lt-sm:w-340px max-h-600px bg-[rgba(255,255,255,0.92)] dark:bg-[rgba(15,18,30,0.92)] border-1px border-solid border-[rgba(100,108,255,0.2)] rd-12px backdrop-blur-16px overflow-hidden"
        :style="{ boxShadow: '0 6px 24px rgba(0,0,0,0.08), 0 0 1px rgba(100,108,255,0.3), inset 0 1px 0 rgba(255,255,255,0.3)' }"
      >
        <!-- Header -->
        <div class="flex justify-between items-center px-14px py-12px border-b-1px border-b-solid border-[var(--primary-color)]/20">
          <div class="flex items-center gap-8px text-14px font-500 dark:text-white/85 text-gray-800">
            <span class="w-6px h-6px rd-full bg-[var(--primary-color)] shadow-[0_0_6px_var(--primary-color)]" />
            <span>传输列表</span>
            <span class="text-14px bg-[var(--primary-color)]/15 dark:text-[var(--primary-400)] text-[var(--primary-600)] px-6px rd-6px">{{ activeCount }}</span>
          </div>
          <div class="flex gap-6px">
            <button class="w-28px h-28px border-none rd-6px bg-transparent text-black/40 dark:text-white/50 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[rgba(100,108,255,0.15)] hover:text-[var(--primary-color)]" title="球体视图" @click="switchToSphere">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="9" />
                <ellipse cx="12" cy="12" rx="9" ry="4" />
                <ellipse cx="12" cy="12" rx="4" ry="9" />
              </svg>
            </button>
            <button class="w-28px h-28px border-none rd-6px bg-transparent text-black/40 dark:text-white/50 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[rgba(100,108,255,0.15)] hover:text-[var(--primary-color)]" @click="closePanel">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Transfer list -->
        <div class="transfer-scroll">
          <!-- Folder groups -->
          <div v-for="[folderId, group] in folderGroups" :key="folderId" class="mb-4px rd-8px border-1px border-solid border-[rgba(100,108,255,0.1)] overflow-hidden dark:border-[rgba(100,108,255,0.15)]">
            <!-- Folder header -->
            <div class="flex justify-between items-center p-10px-12px cursor-pointer transition-bg duration-200 hover:bg-[rgba(100,108,255,0.04)] dark:hover:bg-[rgba(100,108,255,0.08)]" @click="toggleFolder(folderId)">
              <div class="flex items-center gap-8px overflow-hidden flex-1">
                <svg
                  class="shrink-0 transition-transform duration-200"
                  :style="{ transform: expandedFolders.has(folderId) ? 'rotate(90deg)' : 'rotate(0deg)' }"
                  viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
                <FileIcon file-type="folder" size="small" />
                <span class="text-14px dark:text-white/80 text-gray-700 whitespace-nowrap truncate">{{ group.name }}</span>
              </div>
              <div class="flex items-center gap-8px" @click.stop>
                <span class="text-13px dark:text-white/40 text-gray-400">
                  {{ group.items.filter(i => i.status === 'completed').length }}/{{ group.items.length }}
                </span>
                <span class="text-14px font-600 tabular-nums" :style="{ color: getStatusColor(getFolderStatus(group.items)) }">
                  {{ getFolderProgress(group.items) }}%
                </span>
                <button
                  v-if="getFolderStatus(group.items) === 'transferring'"
                  class="w-28px h-28px border-none rd-full bg-transparent text-black/25 dark:text-white/30 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red/10 hover:text-[var(--n-error-color)]"
                  title="暂停全部"
                  @click="pauseFolder(folderId)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="10" y1="6" x2="10" y2="18" />
                    <line x1="14" y1="6" x2="14" y2="18" />
                  </svg>
                </button>
                <button
                  v-if="getFolderStatus(group.items) === 'paused'"
                  class="w-28px h-28px border-none rd-full bg-transparent cursor-pointer flex items-center justify-center transition-all duration-200 text-[var(--primary-color)] hover:bg-red/10 hover:text-[var(--n-error-color)]"
                  title="继续全部"
                  @click="resumeFolder(folderId)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <polygon points="8,6 18,12 8,18" />
                  </svg>
                </button>
                <button class="w-28px h-28px border-none rd-full bg-transparent text-black/25 dark:text-white/30 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red/10 hover:text-[var(--n-error-color)]" title="取消全部" @click="cancelFolder(folderId)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <!-- Folder aggregate progress bar -->
            <div class="h-6px rd-3px bg-gray-200 dark:bg-white/6 overflow-hidden mx-10px mb-2px">
              <div
                class="h-full rd-3px transition-width duration-300"
                :style="{ width: `${getFolderProgress(group.items)}%`, background: getStatusColor(getFolderStatus(group.items)) }"
              />
            </div>
            <!-- Expanded file list -->
            <div v-if="expandedFolders.has(folderId)" class="p-x-4px pb-4px border-t-1px border-t-solid border-t-[rgba(100,108,255,0.08)] dark:border-t-[rgba(100,108,255,0.12)]">
              <div v-for="item in group.items" :key="item.transferId" class="p-8px mb-3px rd-8px transition-bg duration-200 hover:bg-[rgba(100,108,255,0.06)] dark:hover:bg-[rgba(100,108,255,0.1)]">
                <div class="flex justify-between items-center mb-4px">
                  <div class="flex items-center gap-8px overflow-hidden">
                    <FileIcon :file-type="getFileTypeCategory(item.fileType)" :extension="item.fileType" size="small" />
                    <span class="text-13px dark:text-white/80 text-gray-700 whitespace-nowrap truncate max-w-300px">{{ item.fileName }}</span>
                  </div>
                  <div class="flex items-center gap-6px">
                    <span class="text-13px font-600 tabular-nums" :style="{ color: getStatusColor(item.status) }">
                      {{ isPreparingStatus(item.status) ? getStatusText(item) : item.status === 'failed' ? getStatusText(item) : `${item.progress}%` }}
                    </span>
                    <button
                      v-if="isActiveStatus(item.status)"
                      class="w-28px h-28px border-none rd-full bg-transparent text-black/25 dark:text-white/30 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red/10 hover:text-[var(--n-error-color)]"
                      title="暂停"
                      @click="pause(item.transferId)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="10" y1="6" x2="10" y2="18" />
                        <line x1="14" y1="6" x2="14" y2="18" />
                      </svg>
                    </button>
                    <button
                      v-if="item.status === 'paused'"
                      class="w-28px h-28px border-none rd-full bg-transparent cursor-pointer flex items-center justify-center transition-all duration-200 text-[var(--primary-color)] hover:bg-red/10 hover:text-[var(--n-error-color)]"
                      title="继续"
                      @click="resume(item.transferId)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <polygon points="8,6 18,12 8,18" />
                      </svg>
                    </button>
                    <button
                      v-if="item.status === 'failed'"
                      class="w-28px h-28px border-none rd-full bg-transparent cursor-pointer flex items-center justify-center transition-all duration-200 text-[var(--n-warning-color)] hover:bg-red/10 hover:text-[var(--n-error-color)]"
                      title="重试"
                      @click="retry(item.transferId)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="1,4 1,10 7,10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </button>
                    <button
                      v-if="item.status !== 'completed'"
                      class="w-28px h-28px border-none rd-full bg-transparent text-black/25 dark:text-white/30 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red/10 hover:text-[var(--n-error-color)]"
                      title="取消"
                      @click="cancelTransfer(item.transferId)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- Preparing: indeterminate bar -->
                <div v-if="isPreparingStatus(item.status)" class="h-6px rd-3px bg-gray-200 dark:bg-white/6 overflow-hidden mx-10px">
                  <div class="h-full rd-2px w-30% progress-indeterminate" :style="{ background: getStatusColor(item.status) }" />
                </div>
                <!-- Uploading/merging: real progress -->
                <div v-else class="h-6px rd-3px bg-gray-200 dark:bg-white/6 overflow-hidden mx-10px">
                  <div
                    class="h-full rd-3px transition-width duration-300"
                    :style="{ width: `${item.progress}%`, background: getStatusColor(item.status) }"
                  />
                </div>
                <!-- Progress info -->
                <div v-if="!isPreparingStatus(item.status) && isActiveStatus(item.status)" class="flex justify-between items-center text-14px dark:text-white/35 text-gray-400 mt-3px tabular-nums mx-10px">
                  <span>{{ formatFileSize(item.transferredSize) }} / {{ formatFileSize(item.totalSize) }}</span>
                  <div class="flex items-center gap-6px">
                    <span>{{ formatFileSize(item.speed) }}/s</span>
                    <button class="text-11px text-[var(--primary-color)] opacity-60 hover:opacity-100 cursor-pointer bg-transparent border-none px-2px" @click.stop="toggleDetail(item.transferId)">
                      {{ expandedDetails.has(item.transferId) ? '收起' : '详情' }}
                    </button>
                  </div>
                </div>
                <div v-else-if="getStatusText(item)" class="text-14px mt-3px tabular-nums mx-10px">
                  <span :style="{ color: getStatusColor(item.status) }">{{ getStatusText(item) }}</span>
                </div>
                <!-- Chunk detail -->
                <div v-if="expandedDetails.has(item.transferId)" class="mt-4px mx-10px px-6px py-4px rd-4px bg-[rgba(100,108,255,0.04)] dark:bg-[rgba(100,108,255,0.08)] text-14px dark:text-white/40 text-gray-400 flex flex-col gap-2px tabular-nums">
                  <div class="flex justify-between">
                    <span>文件大小</span>
                    <span>{{ formatFileSize(item.totalSize) }}</span>
                  </div>
                  <div v-if="item.chunkProgress" class="flex justify-between">
                    <span>分片进度</span>
                    <span>{{ item.chunkProgress }} 分片</span>
                  </div>
                  <div v-if="item.remainingTime > 0" class="flex justify-between">
                    <span>预计剩余</span>
                    <span>{{ item.remainingTime }}s</span>
                  </div>
                  <div class="flex justify-between">
                    <span>当前阶段</span>
                    <span :style="{ color: getStatusColor(item.status) }">{{ getStatusText(item) || item.status }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Ungrouped individual items -->
          <div v-for="item in ungroupedItems" :key="item.transferId" class="p-10px-12px rd-6px mb-4px transition-bg duration-200 hover:bg-[rgba(100,108,255,0.06)] dark:hover:bg-[rgba(100,108,255,0.1)]">
            <div class="flex justify-between items-center mb-4px">
              <div class="flex items-center gap-8px overflow-hidden">
                <FileIcon :file-type="getFileTypeCategory(item.fileType)" :extension="item.fileType" size="small" />
                <span class="text-14px dark:text-white/80 text-gray-700 whitespace-nowrap truncate max-w-360px">{{ item.fileName }}</span>
              </div>
              <div class="flex items-center gap-8px">
                <span class="text-14px font-600 tabular-nums" :style="{ color: getStatusColor(item.status) }">
                  {{ item.status === 'failed' ? getStatusText(item) : `${item.progress}%` }}
                </span>
                <!-- Pause button: active statuses -->
                <button
                  v-if="isActiveStatus(item.status)"
                  class="w-28px h-28px border-none rd-full bg-transparent text-black/25 dark:text-white/30 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red/10 hover:text-[var(--n-error-color)]"
                  title="暂停"
                  @click="pause(item.transferId)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="10" y1="6" x2="10" y2="18" />
                    <line x1="14" y1="6" x2="14" y2="18" />
                  </svg>
                </button>
                <!-- Resume button: paused -->
                <button
                  v-if="item.status === 'paused'"
                  class="w-28px h-28px border-none rd-full bg-transparent cursor-pointer flex items-center justify-center transition-all duration-200 text-[var(--primary-color)] hover:bg-red/10 hover:text-[var(--n-error-color)]"
                  title="继续"
                  @click="resume(item.transferId)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <polygon points="8,6 18,12 8,18" />
                  </svg>
                </button>
                <!-- Retry button: failed -->
                <button
                  v-if="item.status === 'failed'"
                  class="w-28px h-28px border-none rd-full bg-transparent cursor-pointer flex items-center justify-center transition-all duration-200 text-[var(--n-warning-color)] hover:bg-red/10 hover:text-[var(--n-error-color)]"
                  title="重试"
                  @click="retry(item.transferId)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="1,4 1,10 7,10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
                <!-- Cancel button: all non-completed -->
                <button
                  v-if="item.status !== 'completed'"
                  class="w-28px h-28px border-none rd-full bg-transparent text-black/25 dark:text-white/30 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red/10 hover:text-[var(--n-error-color)]"
                  title="取消"
                  @click="cancelTransfer(item.transferId)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="h-6px rd-3px bg-gray-200 dark:bg-white/6 overflow-hidden mx-10px">
              <div
                class="h-full rd-3px transition-width duration-300"
                :style="{ width: `${item.progress}%`, background: getStatusColor(item.status) }"
              />
            </div>
            <!-- Progress info -->
            <div v-if="isActiveStatus(item.status)" class="flex justify-between items-center text-14px dark:text-white/35 text-gray-400 mt-3px tabular-nums">
              <span>{{ formatFileSize(item.transferredSize) }} / {{ formatFileSize(item.totalSize) }}</span>
              <div class="flex items-center gap-6px">
                <span>{{ formatFileSize(item.speed) }}/s</span>
                <button class="text-11px text-[var(--primary-color)] opacity-60 hover:opacity-100 cursor-pointer bg-transparent border-none px-2px" @click.stop="toggleDetail(item.transferId)">
                  {{ expandedDetails.has(item.transferId) ? '收起' : '详情' }}
                </button>
              </div>
            </div>
            <div v-else-if="getStatusText(item)" class="text-14px mt-3px tabular-nums">
              <span :style="{ color: getStatusColor(item.status) }">{{ getStatusText(item) }}</span>
            </div>
            <!-- Chunk detail -->
            <div v-if="expandedDetails.has(item.transferId)" class="mt-4px px-6px py-4px rd-4px bg-[rgba(100,108,255,0.04)] dark:bg-[rgba(100,108,255,0.08)] text-14px dark:text-white/40 text-gray-400 flex flex-col gap-2px tabular-nums">
              <div class="flex justify-between">
                <span>文件大小</span>
                <span>{{ formatFileSize(item.totalSize) }}</span>
              </div>
              <div v-if="item.chunkProgress" class="flex justify-between">
                <span>分片进度</span>
                <span>{{ item.chunkProgress }} 分片</span>
              </div>
              <div v-if="item.remainingTime > 0" class="flex justify-between">
                <span>预计剩余</span>
                <span>{{ item.remainingTime }}s</span>
              </div>
              <div class="flex justify-between">
                <span>当前阶段</span>
                <span :style="{ color: getStatusColor(item.status) }">{{ getStatusText(item) || item.status }}</span>
              </div>
            </div>
          </div>

          <div v-if="activeTransfers.length === 0" class="text-center text-14px dark:text-white/30 text-gray-400 py-20px">
            暂无传输任务
          </div>
        </div>

        <!-- Bottom action bar -->
        <div v-if="activeTransfers.length > 1" class="flex justify-between items-center px-12px py-8px border-t-1px border-t-solid border-[var(--primary-color)]/10">
          <span class="text-13px dark:text-white/40 text-gray-400">{{ activeCount }} 个任务</span>
          <div class="flex gap-8px">
            <button class="text-13px text-[var(--primary-color)] hover:underline" @click="pauseAll">全部暂停</button>
            <button class="text-13px text-[var(--primary-color)] hover:underline" @click="resumeAll">全部继续</button>
          </div>
        </div>
      </div>

      <div v-else-if="isVisible && viewMode === 'sphere'" key="sphere" class="flex flex-col items-center gap-8px">
        <!-- Control buttons -->
        <div class="flex justify-end w-160px gap-6px lt-sm:w-130px">
          <!-- PC端才显示列表视图切换按钮 -->
          <button v-if="!appStore.isMobile" class="action-btn dark:bg-[rgba(15,18,30,0.92)] bg-white/92 border-1px border-solid border-[var(--primary-color)]/20 backdrop-blur-12px" title="列表视图" @click="switchToList">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button class="action-btn dark:bg-[rgba(15,18,30,0.92)] bg-white/92 border-1px border-solid border-[var(--primary-color)]/20 backdrop-blur-12px" @click="closePanel">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Sphere container -->
        <div class="relative w-160px h-160px lt-sm:w-130px lt-sm:h-130px">
          <!-- Outer glow ring -->
          <div class="sphere-glow" />

          <!-- Progress ring -->
          <div class="absolute inset-0">
            <svg class="w-full h-full" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="74" fill="none" stroke="var(--primary-color)" stroke-opacity="8" stroke-width="1.5" />
              <circle
                class="ring-fill"
                cx="80" cy="80" r="74"
                fill="none"
                stroke="url(#sGrad)"
                stroke-width="1.5"
                stroke-linecap="round"
                :stroke-dasharray="`${overallProgress * 4.65} 465`"
                transform="rotate(-90 80 80)"
              />
              <defs>
                <linearGradient id="sGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--primary-color)" />
                  <stop offset="100%" stop-color="var(--primary-400)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <!-- Sphere body -->
          <div class="sphere-body" :class="{ 'completed-state': allCompleted }">
            <!-- ECharts liquidfill 水球图 -->
            <div
              v-if="!isEmpty"
              ref="chartContainerRef"
              class="liquidfill-container"
            />

            <!-- Center content -->
            <div class="absolute inset-0 flex flex-col items-center justify-center z-2">
              <!-- Empty state -->
              <template v-if="isEmpty">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--primary-color)" stroke-width="1.2" opacity="0.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12h8" />
                </svg>
                <span class="text-13px mt-6px opacity-50 dark:text-white/50 text-gray-500">暂无任务</span>
              </template>

              <!-- Completed state -->
              <template v-else-if="allCompleted">
                <div class="check-icon">
                  <svg viewBox="0 0 80 80" width="48" height="48">
                    <circle
                      class="check-bg"
                      cx="40" cy="40" r="36"
                      fill="none"
                      stroke="#FFFFFF"
                      stroke-width="2"
                      stroke-dasharray="226"
                      stroke-dashoffset="226"
                    />
                    <path
                      class="check-mark"
                      d="M24 42 L34 52 L56 30"
                      fill="none"
                      stroke="#FFFFFF"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-dasharray="60"
                      stroke-dashoffset="60"
                    />
                  </svg>
                </div>
              </template>

              <!-- Active transfer state -->
              <template v-else>
                <span class="text-24px font-700 dark:text-white text-gray-800 tabular-nums lh-1 sphere-percent">{{ overallProgress }}%</span>
                <span class="text-14px mt-12px tabular-nums opacity-80 dark:text-[var(--primary-400)] text-[var(--primary-600)]">{{ formatFileSize(totalSpeed) }}/s</span>
              </template>
            </div>
          </div>

          <!-- Orbiting particles with trails -->
          <div class="orbit orbit-1">
            <div class="particle particle-1" />
          </div>
          <div class="orbit orbit-2">
            <div class="particle particle-2" />
          </div>
        </div>

        <!-- Bottom info -->
        <div>
          <span v-if="isEmpty" class="text-14px dark:text-white/30 text-gray-400 tracking-0.5px">暂无任务</span>
          <span v-else-if="allCompleted" class="text-14px sphere-complete-text tracking-0.5px" style="color: var(--n-success-color)">全部完成</span>
          <span v-else class="text-14px dark:text-white/40 text-gray-400 tracking-0.5px">{{ activeCount }} 个任务传输中</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.transfer-scroll {
  max-height: 560px;
  overflow-y: auto;
  padding: 6px 8px;
}
.transfer-scroll::-webkit-scrollbar {
  width: 3px;
}
.transfer-scroll::-webkit-scrollbar-thumb {
  background: rgba(100, 108, 255, 0.2);
  border-radius: 2px;
}

.sphere-glow {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px solid rgba(100, 108, 255, 0.08);
  animation: pulseGlow 4s ease-in-out infinite;
}
:root.dark .sphere-glow {
  border-color: rgba(100, 108, 255, 0.12);
  box-shadow: 0 0 20px rgba(100, 108, 255, 0.08), 0 0 40px rgba(100, 108, 255, 0.04);
}

.sphere-body {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 40%, rgba(100, 108, 255, 0.12) 0%, transparent 50%),
    radial-gradient(circle at 50% 60%, rgba(100, 108, 255, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(245, 247, 255, 0.95) 0%, rgba(230, 235, 255, 0.98) 100%);
  border: 1px solid rgba(100, 108, 255, 0.15);
  overflow: hidden;
  box-shadow:
    0 0 30px rgba(100, 108, 255, 0.08),
    0 0 60px rgba(100, 108, 255, 0.04),
    inset 0 0 40px rgba(100, 108, 255, 0.03);
}
:root.dark .sphere-body {
  background:
    radial-gradient(circle at 50% 40%, rgba(140, 150, 255, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 50% 60%, rgba(100, 108, 255, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(20, 24, 50, 0.95) 0%, rgba(10, 12, 30, 0.98) 100%);
  border-color: rgba(100, 108, 255, 0.2);
  box-shadow:
    0 0 30px rgba(100, 108, 255, 0.12),
    0 0 60px rgba(100, 108, 255, 0.06),
    inset 0 0 40px rgba(100, 108, 255, 0.04);
}

:root.dark .sphere-percent {
  text-shadow: 0 0 16px rgba(100, 108, 255, 0.5);
}

.liquidfill-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  z-index: 0;
}

.ring-fill {
  transition: stroke-dasharray 0.5s ease;
  filter: drop-shadow(0 0 4px rgba(100, 108, 255, 0.5));
}

.check-icon {
  animation: checkPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.check-bg {
  animation: drawCircle 0.6s ease-out 0.1s forwards;
}
.check-mark {
  animation: drawCheck 0.4s ease-out 0.5s forwards;
  filter: drop-shadow(0 0 6px rgba(82, 196, 26, 0.5));
}

.sphere-complete-text {
  text-shadow: 0 0 8px rgba(82, 196, 26, 0.4);
  animation: fadeInUp 0.4s ease-out 0.7s both;
}

.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  pointer-events: none;
}
.particle {
  position: absolute;
  border-radius: 50%;
  left: 50%;
  transform: translateX(-50%);
}
.orbit-1 {
  width: 168px;
  height: 168px;
  margin: -84px 0 0 -84px;
  animation: orbitSpin 12s linear infinite;
}
.particle-1 {
  width: 4px;
  height: 4px;
  top: -2px;
  background: var(--primary-color);
  box-shadow: 0 0 8px var(--primary-color), 0 0 16px rgba(100, 108, 255, 0.4), 0 0 4px var(--primary-color);
}
.orbit-2 {
  width: 184px;
  height: 184px;
  margin: -92px 0 0 -92px;
  animation: orbitSpin 18s linear infinite reverse;
}
.particle-2 {
  width: 3px;
  height: 3px;
  bottom: -1.5px;
  top: auto;
  background: var(--primary-400);
  box-shadow: 0 0 6px var(--primary-400), 0 0 12px rgba(100, 108, 255, 0.3);
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.5; box-shadow: 0 0 10px rgba(100, 108, 255, 0.04); }
  50% { opacity: 1; box-shadow: 0 0 20px rgba(100, 108, 255, 0.1), 0 0 40px rgba(100, 108, 255, 0.05); }
}
@keyframes checkPop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes drawCircle { to { stroke-dashoffset: 0; } }
@keyframes drawCheck { to { stroke-dashoffset: 0; } }
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes orbitSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.progress-indeterminate {
  animation: indeterminateSlide 1.5s ease-in-out infinite;
}
@keyframes indeterminateSlide {
  0% { width: 20%; margin-left: 0; }
  50% { width: 40%; margin-left: 30%; }
  100% { width: 20%; margin-left: 80%; }
}

.view-switch-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 1, 1); }
.view-switch-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.view-switch-leave-to { opacity: 0; transform: scale(0.92); }
.view-switch-enter-from { opacity: 0; transform: scale(0.92) translateY(8px); }
</style>
