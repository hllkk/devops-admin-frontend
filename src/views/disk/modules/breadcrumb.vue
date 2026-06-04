<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';

defineOptions({
  name: 'DiskBreadcrumb'
});

interface Props {
  totalCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  totalCount: 0
});

const diskStore = useDiskStore();

// 是否在根目录
const isRoot = computed(() => diskStore.currentPath.length === 0);

// 返回上一级
function goBack() {
  diskStore.goBack();
}

// 点击面包屑项
// index 0 = 全部文件（根目录），index 1+ = 子文件夹
function handleBreadcrumbClick(index: number) {
  if (index === 0) {
    // 点击"全部文件"返回根目录
    diskStore.resetPath();
  } else {
    // 点击子文件夹，截断到该位置
    diskStore.goBack(index - 1);
  }
}
</script>

<template>
  <div class="disk-breadcrumb">
    <!-- 返回上一级按钮（非根目录时显示） -->
    <NButton
      v-if="!isRoot"
      quaternary
      size="small"
      class="back-btn"
      @click="goBack"
    >
      <template #icon>
        <NIcon size="16">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </NIcon>
      </template>
      {{ $t('page.disk.breadcrumb.back') }}
    </NButton>

    <NDivider v-if="!isRoot" vertical />

    <!-- 面包屑 -->
    <NBreadcrumb>
      <!-- 全部文件（根目录） -->
      <NBreadcrumbItem class="ml-4" @click="handleBreadcrumbClick(0)">
        {{ $t('page.disk.breadcrumb.allFiles') }}
      </NBreadcrumbItem>
      <!-- 子文件夹路径 -->
      <NBreadcrumbItem
        v-for="(item, index) in diskStore.currentPath"
        :key="item.fileId"
        @click="handleBreadcrumbClick(index + 1)"
      >
        {{ item.fileName }}
      </NBreadcrumbItem>
    </NBreadcrumb>

    <!-- 文件数量统计 -->
    <div class="breadcrumb-count mr-4">
      {{ $t('page.disk.breadcrumb.loaded') }}，
      {{ $t('page.disk.breadcrumb.total', { count: props.totalCount }) }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.disk-breadcrumb {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 8px;

  .back-btn {
    --n-padding: 0 8px;
    --n-height: 28px;
  }

  .breadcrumb-count {
    margin-left: auto;
    font-size: 12px;
    color: var(--n-text-color-disabled);
  }
}
</style>
