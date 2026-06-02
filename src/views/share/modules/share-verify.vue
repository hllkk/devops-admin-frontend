<script setup lang="ts">
import { ref } from 'vue';
import { $t } from '@/locales';
import FileIcon from '@/views/disk/modules/file-icon.vue';

defineOptions({
  name: 'ShareVerify'
});

interface Props {
  /** 短链接ID（父组件传递，本组件暂未使用） */
  // eslint-disable-next-line vue/no-unused-properties
  shortId?: string;
  shareInfo: Api.Disk.SharePublicInfo | null;
  /** 预填提取码（来自 URL ?pwd= 参数） */
  prefillCode?: string;
}

interface Emits {
  (e: 'verify', code: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const extractionCode = ref(props.prefillCode || '');
const loading = ref(false);

// 提交验证
function handleVerify() {
  if (!extractionCode.value || extractionCode.value.length !== 4) {
    window.$message?.warning('请输入4位提取码');
    return;
  }

  loading.value = true;
  emit('verify', extractionCode.value);
  // loading 由父组件控制，这里延迟关闭
  setTimeout(() => {
    loading.value = false;
  }, 1000);
}

// 输入框过滤非法字符
function handleInput(value: string) {
  extractionCode.value = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
}
</script>

<template>
  <div class="w-full max-w-400px flex flex-col items-center gap-24px">
    <!-- 图标和提示 -->
    <div class="flex flex-col items-center gap-12px">
      <SvgIcon icon="mdi:lock-outline" :size="48" class="text-primary opacity-60" />
      <div class="text-16px font-medium">{{ $t('page.share.verifyTitle') }}</div>
    </div>

    <!-- 分享文件信息 -->
    <div v-if="shareInfo" class="w-full p-16px rounded bg-white dark:bg-gray-800 shadow-sm">
      <div class="flex items-center gap-12px">
        <FileIcon
          :file-type="shareInfo.fileType"
          :extension="shareInfo.fileExtension"
          size="medium"
        />
        <div class="flex-1 min-w-0">
          <div class="text-14px font-medium truncate">{{ shareInfo.fileName }}</div>
          <div class="text-12px opacity-60">
            {{ $t('page.share.sharer') }}: {{ shareInfo.sharerName }}
          </div>
        </div>
      </div>
    </div>

    <!-- 提取码输入 -->
    <div class="w-full flex flex-col gap-12px">
      <div class="text-14px opacity-70 text-center">{{ $t('page.share.inputExtractionCode') }}</div>
      <NInput
        v-model:value="extractionCode"
        :placeholder="$t('page.share.extractionCodePlaceholder')"
        size="large"
        class="text-center"
        :maxlength="4"
        @input="handleInput"
      />
      <NButton
        type="primary"
        block
        :loading="loading"
        :disabled="extractionCode.length !== 4"
        @click="handleVerify"
      >
        {{ $t('page.share.verifyAndAccess') }}
      </NButton>
    </div>

    <!-- 提示 -->
    <div class="text-12px opacity-50">
      {{ $t('page.share.verifyTip') }}
    </div>
  </div>
</template>