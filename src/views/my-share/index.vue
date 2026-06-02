<script setup lang="ts">
import { h, ref, computed } from 'vue';
import { NTag } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { fetchGetMyShareList, fetchCancelShare, fetchGetShareInfo } from '@/service/api/disk/share';
import { useDiskStore } from '@/store/modules/disk';
import { handleCopy } from '@/utils/copy';
import FileIcon from '../disk/modules/file-icon.vue';
import FileEmpty from '@/components/disk/file-empty.vue';
import ShareDialog from '../disk/modules/share-dialog.vue';

defineOptions({
  name: 'MySharePage'
});

const { loading, startLoading, endLoading } = useLoading();

const shareList = ref<Api.Disk.MyShareItem[]>([]);
const total = ref(0);
const pagination = ref({ pageNum: 1, pageSize: 20 });
const checkedRowKeys = ref<number[]>([]);

const checkedCount = computed(() => checkedRowKeys.value.length);
const diskStore = useDiskStore();

const existingShareInfo = ref<Api.Disk.ShareResult | null>(null);

async function handleFileNameClick(item: Api.Disk.MyShareItem) {
  existingShareInfo.value = null;
  const { data } = await fetchGetShareInfo(item.fileId);
  if (data) {
    existingShareInfo.value = data;
  }
  diskStore.openShareDialog({
    fileId: item.fileId,
    fileName: item.fileName,
    fileType: contentTypeToFileType(item.contentType, item.isFolder),
    fileExtension: item.fileExtension,
    isFolder: item.isFolder,
    fileSize: item.fileSize,
    parentId: null,
    filePath: '',
    modifyTime: ''
  } as Api.Disk.FileItem);
}

function buildShareLink(shortId: string) {
  return `${window.location.origin}/s/${shortId}`;
}

function contentTypeToFileType(contentType: string, isFolder: boolean): string {
  if (isFolder) return 'folder';
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('image')) return 'image';
  if (ct.includes('video')) return 'video';
  if (ct.includes('audio')) return 'audio';
  if (ct.includes('pdf') || ct.includes('document') || ct.includes('word') || ct.includes('text')) return 'document';
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('xls')) return 'document';
  if (ct.includes('presentation') || ct.includes('ppt') || ct.includes('powerpoint')) return 'document';
  if (ct.includes('zip') || ct.includes('rar') || ct.includes('7z') || ct.includes('tar') || ct.includes('compressed')) return 'other';
  return 'other';
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const columns = [
  {
    type: 'selection' as const,
    width: 48
  },
  {
    key: 'fileName',
    title: '分享文件',
    width: 200,
    ellipsis: { tooltip: true },
    render(row: Api.Disk.MyShareItem) {
      return h('div', { class: 'flex items-center gap-8px' }, [
        h(FileIcon, {
          fileType: contentTypeToFileType(row.contentType, row.isFolder),
          extension: row.fileExtension,
          size: 'small'
        }),
        h('span', { class: 'truncate cursor-pointer hover:text-primary transition-colors', onClick: () => handleFileNameClick(row) }, row.fileName)
      ]);
    }
  },
  {
    key: 'shareLink',
    title: '分享链接',
    width: 380,
    render(row: Api.Disk.MyShareItem) {
      const link = buildShareLink(row.shortId);
      return h('div', { class: 'flex items-center gap-8px share-link-cell' }, [
        h(
          'span',
          {
            class: 'flex-1 truncate text-13px opacity-70 cursor-pointer hover:text-primary hover:opacity-100 transition-colors',
            onClick: () => handleCopy(link)
          },
          link
        ),
        h(
          'button',
          {
            class: 'row-action-btn opacity-0 transition-opacity cursor-pointer hover:opacity-80 p-0 bg-transparent border-none',
            onClick: (e: MouseEvent) => {
              e.stopPropagation();
              handleCancelSingle(row.shareId, row.fileName);
            }
          },
          h(SvgIcon, { icon: 'material-symbols:share-off-outline-rounded', class: 'text-error', style: 'font-size:20px' })
        )
      ]);
    }
  },
  {
    key: 'createDate',
    title: '创建时间',
    width: 170,
    render(row: Api.Disk.MyShareItem) {
      return h('span', { class: 'text-13px opacity-70' }, formatDateTime(row.createDate));
    }
  },
  {
    key: 'isPrivate',
    title: '分享形式',
    width: 90,
    align: 'center' as const,
    render(row: Api.Disk.MyShareItem) {
      return h(NTag, { size: 'small', type: row.isPrivate ? 'warning' : 'success' }, () =>
        row.isPrivate ? '私密' : '公开'
      );
    }
  },
  {
    key: 'expireDate',
    title: '过期时间',
    width: 150,
    align: 'center' as const,
    render(row: Api.Disk.MyShareItem) {
      return h('span', { class: 'text-13px opacity-70' }, row.expireDate ? formatDateTime(row.expireDate) : '永久');
    }
  }
];

const rowKey = (row: Api.Disk.MyShareItem) => row.shareId;

const showEmpty = computed(() => shareList.value.length === 0 && !loading.value);

async function getData() {
  startLoading();
  checkedRowKeys.value = [];
  const { data, error } = await fetchGetMyShareList(pagination.value);
  endLoading();

  if (!error && data) {
    shareList.value = data.rows || [];
    total.value = data.total;
  }
}

async function handleBatchCancel() {
  if (checkedRowKeys.value.length === 0) return;

  window.$dialog?.warning({
    title: $t('page.disk.myShare.cancelShare'),
    content: checkedRowKeys.value.length === 1
      ? $t('page.disk.myShare.cancelConfirm')
      : `确定取消分享 ${checkedRowKeys.value.length} 个文件？`,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      startLoading();
      let failCount = 0;
      for (const shareId of checkedRowKeys.value) {
        const { error } = await fetchCancelShare(shareId);
        if (error) failCount++;
      }
      endLoading();
      if (failCount === 0) {
        window.$message?.success($t('page.disk.myShare.cancelSuccess'));
      } else {
        window.$message?.warning(`${failCount} 个分享取消失败`);
      }
      getData();
    }
  });
}

async function handleCancelSingle(shareId: number, fileName: string) {
  window.$dialog?.warning({
    title: $t('page.disk.myShare.cancelShare'),
    content: `确定取消分享 "${fileName}"？`,
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      const { error } = await fetchCancelShare(shareId);
      if (!error) {
        window.$message?.success($t('page.disk.myShare.cancelSuccess'));
        getData();
      }
    }
  });
}

function handleCopyLink(shortId: string) {
  handleCopy(buildShareLink(shortId));
}

function handlePageChange(page: number) {
  pagination.value.pageNum = page;
  getData();
}

// 初始化
getData();
</script>

<template>
  <div class="min-h-500px h-full flex-col-stretch gap-0 overflow-hidden lt-lg:overflow-auto">
    <NCard :bordered="false" size="small" class="card-wrapper h-full flex-1-hidden">
      <div class="h-full flex flex-col">
        <!-- 选中操作栏 -->
        <div v-if="checkedCount > 0" class="flex items-center gap-12px px-4px py-8px">
          <span class="text-13px opacity-70">已选中 {{ checkedCount }} 项</span>
          <NButton size="small" type="error" @click="handleBatchCancel">
            取消分享
          </NButton>
        </div>

        <!-- 内容区域 -->
        <div class="flex-1 min-h-0 overflow-auto">
          <FileEmpty v-if="showEmpty" :description="$t('page.disk.myShare.empty')" />

          <!-- PC端：表格视图 -->
          <NDataTable
            v-if="!showEmpty"
            class="lt-sm:hidden"
            :columns="columns"
            :data="shareList"
            :row-key="rowKey"
            :loading="loading"
            :checked-row-keys="checkedRowKeys"
            :max-height="500"
            :scroll-x="900"
            @update:checked-row-keys="checkedRowKeys = $event as number[]"
          />

          <!-- 手机端：卡片列表视图 -->
          <NSpin v-if="!showEmpty" :show="loading" class="sm:hidden lt-sm:block">
            <div v-if="shareList.length > 0" class="flex flex-col gap-12px p-12px">
              <div
                v-for="item in shareList"
                :key="item.shareId"
                class="flex flex-col gap-8px p-12px rd-8px bg-gray-50 dark:bg-gray-800"
              >
                <!-- 文件信息 -->
                <div class="flex items-center gap-8px">
                  <FileIcon
                    :file-type="contentTypeToFileType(item.contentType, item.isFolder)"
                    :extension="item.fileExtension"
                    size="small"
                  />
                  <span class="flex-1 truncate text-14px font-medium">{{ item.fileName }}</span>
                  <NTag size="small" :type="item.isPrivate ? 'warning' : 'success'">
                    {{ item.isPrivate ? '私密' : '公开' }}
                  </NTag>
                </div>

                <!-- 分享链接 -->
                <div class="flex items-center gap-8px text-12px">
                  <span class="opacity-50">链接：</span>
                  <span
                    class="flex-1 truncate opacity-70 cursor-pointer hover:text-primary"
                    @click="handleCopyLink(item.shortId)"
                  >
                    /s/{{ item.shortId }}
                  </span>
                </div>

                <!-- 时间信息 -->
                <div class="flex items-center justify-between text-12px opacity-60">
                  <span>{{ formatDateShort(item.createDate) }} 创建</span>
                  <span>{{ item.expireDate ? formatDateShort(item.expireDate) + ' 过期' : '永久有效' }}</span>
                </div>

                <!-- 操作按钮 -->
                <div class="flex items-center justify-end gap-8px pt-4px">
                  <NButton size="tiny" quaternary @click="handleCopyLink(item.shortId)">
                    复制链接
                  </NButton>
                  <NButton size="tiny" type="error" quaternary @click="handleCancelSingle(item.shareId, item.fileName)">
                    取消
                  </NButton>
                </div>
              </div>
            </div>
          </NSpin>
        </div>

        <!-- 分页 -->
        <div v-if="total > pagination.pageSize" class="flex justify-end px-4px py-12px">
          <NPagination
            :page="pagination.pageNum"
            :page-count="Math.ceil(total / pagination.pageSize)"
            :page-size="pagination.pageSize"
            simple
            @update:page="handlePageChange"
          />
        </div>
      </div>
    </NCard>

    <!-- Share Dialog -->
    <ShareDialog
      :existing-share="existingShareInfo"
      @success="getData"
      @cancel-share="getData"
    />
  </div>
</template>

<style scoped lang="scss">
:deep(.n-card__content) {
  padding: 0 !important;
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.n-data-table-tr:hover) .row-action-btn {
  opacity: 1;
}
</style>
