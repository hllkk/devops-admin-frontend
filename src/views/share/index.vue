<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { fetchGetSharePublic, fetchVerifyShare } from '@/service/api/disk/share-public';
import ShareVerify from './modules/share-verify.vue';
import ShareList from './modules/share-list.vue';
import Share403 from './modules/share-403.vue';

defineOptions({
  name: 'SharePage'
});

type PageState = 'loading' | 'verify' | 'list' | '403';

const route = useRoute();

// 获取 shortId 和 pwd 参数
const shortId = computed(() => route.params.shortId as string || '');
const pwdParam = computed(() => route.query.pwd as string || '');

// 页面状态
const pageState = ref<PageState>('loading');

// 分享信息
const shareInfo = ref<Api.Disk.SharePublicInfo | null>(null);

// 错误信息
const errorMessage = ref('');

// 保存已验证的提取码（用于下载时传递）
const verifiedExtractionCode = ref('');

// 系统名称（从配置读取）
const systemName = ref('网盘');

// 加载分享信息
async function loadShareInfo() {
  if (!shortId.value) {
    pageState.value = '403';
    errorMessage.value = '分享链接不存在';
    return;
  }

  const { data, error } = await fetchGetSharePublic(shortId.value);

  if (error || !data) {
    pageState.value = '403';
    errorMessage.value = error?.message || '分享链接不存在或已过期';
    return;
  }

  shareInfo.value = data;

  // 判断是否需要验证提取码
  if (data.isPrivate) {
    // 私密分享：显示提取码输入页面（pwd 参数自动填入输入框）
    pageState.value = 'verify';
  } else {
    // 公开分享：直接显示文件列表
    pageState.value = 'list';
  }
}

// 验证提取码
async function verifyWithCode(code: string) {
  if (!shortId.value) return;

  const { data, error } = await fetchVerifyShare({
    shortId: shortId.value,
    extractionCode: code
  });

  if (error || !data) {
    window.$message?.error('提取码验证失败');
    return;
  }

  // 验证成功，更新分享信息并显示列表
  shareInfo.value = data;
  verifiedExtractionCode.value = code;
  pageState.value = 'list';
}

// 页面加载时获取分享信息
onMounted(() => {
  loadShareInfo();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 顶部品牌标识 -->
    <header class="h-56px flex items-center px-24px bg-white dark:bg-gray-800 shadow-sm">
      <div class="flex items-center gap-12px">
        <SvgIcon icon="mdi:folder-multiple" :size="24" class="text-primary" />
        <span class="text-16px font-medium">{{ systemName }}</span>
      </div>
    </header>

    <!-- 内容区域 -->
    <main class="flex flex-col items-center justify-center p-24px">
      <!-- 加载状态 -->
      <NSpin v-if="pageState === 'loading'" size="large" />

      <!-- 提取码验证页面 -->
      <ShareVerify
        v-else-if="pageState === 'verify'"
        :short-id="shortId"
        :share-info="shareInfo"
        :prefill-code="pwdParam"
        @verify="verifyWithCode"
      />

      <!-- 文件列表页面 -->
      <ShareList
        v-else-if="pageState === 'list'"
        :short-id="shortId"
        :share-info="shareInfo"
        :extraction-code="verifiedExtractionCode"
      />

      <!-- 403 页面 -->
      <Share403
        v-else-if="pageState === '403'"
        :message="errorMessage"
      />
    </main>
  </div>
</template>