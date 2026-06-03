<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchCreateShare, fetchCancelShare, fetchUpdateShare } from '@/service/api/disk/share';
import { formatFileSize } from '@/utils/format';
import { handleCopy } from '@/utils/copy';
import FileIcon from './file-icon.vue';
import ShareToUser from './share-dialog/share-to-user.vue';
import ShareToDept from './share-dialog/share-to-dept.vue';
import QRCode from 'qrcode';

defineOptions({
  name: 'ShareDialog'
});

interface Props {
  existingShare?: Api.Disk.ShareResult | null;
}

const props = withDefaults(defineProps<Props>(), {
  existingShare: null
});

interface Emits {
  (e: 'success', result: Api.Disk.ShareResult): void;
  (e: 'cancelShare', fileId: CommonType.IdType): void;
}

const emit = defineEmits<Emits>();

const diskStore = useDiskStore();

const shareFile = computed(() => diskStore.shareFile);

// 有效期选项
const validityOptions = computed(() => [
  { label: $t('page.disk.share.oneDay'), value: '1' },
  { label: $t('page.disk.share.sevenDays'), value: '7' },
  { label: $t('page.disk.share.thirtyDays'), value: '30' },
  { label: $t('page.disk.share.forever'), value: 'forever' }
]);

const shareTypeOptions = computed(() => [
  { label: $t('page.disk.share.publicLink'), value: 'public' },
  { label: $t('page.disk.share.privateLink'), value: 'private' }
]);

const codeModeOptions = computed(() => [
  { label: $t('page.disk.share.randomGenerate'), value: 'random' },
  { label: $t('page.disk.share.customCode'), value: 'custom' }
]);

// 链接分享配置（创建模式）
const validity = ref('7');
const shareType = ref('public');
const codeMode = ref('random');
const randomCode = ref('');
const customCode = ref('');
const customAddressEnabled = ref(false);
const customAddress = ref('');
const loading = ref(false);

// Tab
const activeTab = ref('link');

// ===== 已有分享管理状态 =====
const editShareType = ref<'public' | 'private'>('public');
const editExpireTimestamp = ref<number | null>(null);
const editPermissions = ref<string[]>([]);
const qrCodeDataUrl = ref('');
const updateLoading = ref(false);

// 已有分享本地副本
const currentShare = ref<Api.Disk.ShareResult | null>(null);

// 已有分享完整链接
const existingShareLink = computed(() => {
  if (!currentShare.value) return '';
  return `${window.location.origin}${currentShare.value.link}`;
});

// 口令文本：链接?pwd=提取码，浏览器打开时自动填写
const shareCodeText = computed(() => {
  if (!currentShare.value) return '';
  const code = currentShare.value.extractionCode || '';
  if (code) {
    return `${existingShareLink.value}?pwd=${code}`;
  }
  return existingShareLink.value;
});

// 已有分享时的可编辑权限（文件: 编辑+删除, 文件夹: 上传+编辑+删除）
const editablePermissions = computed(() => {
  if (shareFile.value?.isFolder) {
    return [
      { label: $t('page.disk.share.permUpload'), value: 'UPLOAD' },
      { label: $t('page.disk.share.permEdit'), value: 'PUT' },
      { label: $t('page.disk.share.permDelete'), value: 'DELETE' }
    ];
  }
  return [
    { label: $t('page.disk.share.permEdit'), value: 'PUT' },
    { label: $t('page.disk.share.permDelete'), value: 'DELETE' }
  ];
});

// 分享形式下拉选项
const shareFormOptions = computed(() => [
  { label: $t('page.disk.share.shareFormPublic'), value: 'public' },
  { label: $t('page.disk.share.shareFormPrivate'), value: 'private' }
]);

const hasExistingShare = computed(() => !!currentShare.value);

const isPrivate = computed(() => shareType.value === 'private');

const codeValid = computed(() => {
  if (!isPrivate.value) return true;
  if (codeMode.value === 'random') return randomCode.value.length === 4;
  return /^[a-zA-Z0-9]{4}$/.test(customCode.value);
});

const addressValid = computed(() => {
  if (!customAddressEnabled.value) return true;
  if (!customAddress.value) return false;
  return /^[a-zA-Z0-9_-]{3,32}$/.test(customAddress.value);
});

const shareLinkPreview = computed(() => {
  const shortId = customAddressEnabled.value && customAddress.value ? customAddress.value : 'xxxxxx';
  return `/s/${shortId}`;
});

const formValid = computed(() => {
  if (!shareFile.value) return false;
  if (!codeValid.value) return false;
  if (!addressValid.value) return false;
  return true;
});

// 文件信息展示
const fileInfo = computed(() => {
  if (!shareFile.value) return null;
  return {
    name: shareFile.value.fileName,
    type: shareFile.value.isFolder ? 'folder' : shareFile.value.fileType,
    extension: shareFile.value.fileExtension,
    size: shareFile.value.fileSize
  };
});

const fileIdNum = computed(() => {
  if (!shareFile.value) return 0;
  return typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10)
    : shareFile.value.fileId;
});

// ===== 同步已有分享数据 =====
watch(() => props.existingShare, async (share) => {
  if (share) {
    currentShare.value = { ...share, operationPermissionList: share.operationPermissionList ? [...share.operationPermissionList] : [] };
    editShareType.value = share.isPrivate ? 'private' : 'public';
    editPermissions.value = share.operationPermissionList ? [...share.operationPermissionList] : [];
    if (share.expireDate) {
      editExpireTimestamp.value = new Date(share.expireDate).getTime();
    } else {
      editExpireTimestamp.value = null;
    }
    try {
      const fullUrl = window.location.origin + share.link;
      qrCodeDataUrl.value = await QRCode.toDataURL(fullUrl, {
        width: 120,
        margin: 2
      });
    } catch {
      qrCodeDataUrl.value = '';
    }
  } else {
    currentShare.value = null;
    qrCodeDataUrl.value = '';
  }
}, { immediate: true });

// ===== 更新分享处理 =====
async function handleUpdateShareType(value: 'public' | 'private') {
  if (!currentShare.value?.shareId) return;
  updateLoading.value = true;
  const isPriv = value === 'private';
  const params: Api.Disk.UpdateShareParams = {
    shareId: currentShare.value.shareId,
    isPrivate: isPriv
  };
  // 从公开切换到私密时，自动生成提取码
  if (isPriv) {
    params.extractionCode = generateRandomCode();
  }
  const { error, data } = await fetchUpdateShare(params);
  if (!error && data) {
    window.$message?.success($t('page.disk.share.updateSuccess'));
    currentShare.value.isPrivate = isPriv;
    if (data.extractionCode) {
      currentShare.value.extractionCode = data.extractionCode;
    } else if (!isPriv) {
      currentShare.value.extractionCode = '';
    }
    editShareType.value = isPriv ? 'private' : 'public';
  }
  updateLoading.value = false;
}

async function handleUpdateExpireDate(ts: number) {
  if (!currentShare.value?.shareId) return;
  updateLoading.value = true;
  const { error } = await fetchUpdateShare({
    shareId: currentShare.value.shareId,
    expireAt: Math.floor(ts / 1000)
  });
  if (!error) {
    window.$message?.success($t('page.disk.share.updateSuccess'));
    currentShare.value.expireDate = new Date(ts).toISOString();
    editExpireTimestamp.value = ts;
  }
  updateLoading.value = false;
}

async function handleUpdatePermissions(perms: string[]) {
  if (!currentShare.value?.shareId) return;
  updateLoading.value = true;
  const { error } = await fetchUpdateShare({
    shareId: currentShare.value.shareId,
    operationPermissionList: perms
  });
  if (!error) {
    window.$message?.success($t('page.disk.share.updateSuccess'));
    if (currentShare.value) {
      currentShare.value.operationPermissionList = [...perms];
    }
  }
  updateLoading.value = false;
}

function toggleEditPermission(perm: string) {
  const current = [...editPermissions.value];
  const idx = current.indexOf(perm);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(perm);
  }
  editPermissions.value = current;
  handleUpdatePermissions(current);
}

// ===== 复制处理 =====
function handleCopyExistingLink() {
  handleCopy(existingShareLink.value);
}

function handleCopyExistingCode() {
  handleCopy(shareCodeText.value);
}

function generateRandomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

const canSubmit = computed(() => {
  if (activeTab.value === 'link' && hasExistingShare.value) return false;
  if (activeTab.value === 'link') return formValid.value;
  return false; // user/dept tabs handle their own submission
});

watch(() => diskStore.shareDialogVisible, async visible => {
  if (visible) {
    validity.value = '7';
    shareType.value = 'public';
    codeMode.value = 'random';
    randomCode.value = generateRandomCode();
    customCode.value = '';
    customAddressEnabled.value = false;
    customAddress.value = '';
    activeTab.value = 'link';
  }
});

function handleCancel() {
  diskStore.closeShareDialog();
}

async function handleConfirm() {
  if (activeTab.value === 'link') {
    await handleLinkShare();
  }
}

async function handleLinkShare() {
  if (!formValid.value || !shareFile.value) return;
  loading.value = true;
  const fileId = typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10)
    : shareFile.value.fileId;
  const params: Api.Disk.CreateShareParams = {
    fileId: fileId,
    isPrivate: isPrivate.value,
    validity: validity.value,
    autoFillExtractCode: isPrivate.value && codeMode.value === 'random',
    extractionCode: isPrivate.value ? (codeMode.value === 'custom' ? customCode.value : randomCode.value) : undefined,
    customAddress: customAddressEnabled.value ? customAddress.value : undefined
  };
  const { data, error } = await fetchCreateShare(params);
  loading.value = false;
  if (!error && data) {
    emit('success', data);
    currentShare.value = { ...data, operationPermissionList: data.operationPermissionList ? [...data.operationPermissionList] : [] };
    editShareType.value = data.isPrivate ? 'private' : 'public';
    editPermissions.value = data.operationPermissionList ? [...data.operationPermissionList] : [];
    editExpireTimestamp.value = data.expireDate ? new Date(data.expireDate).getTime() : null;
    try {
      const fullUrl = window.location.origin + data.link;
      qrCodeDataUrl.value = await QRCode.toDataURL(fullUrl, { width: 120, margin: 2 });
    } catch {
      qrCodeDataUrl.value = '';
    }
  }
}

async function handleCancelExistingShare() {
  if (!currentShare.value?.shareId || !shareFile.value) return;
  loading.value = true;
  const { error } = await fetchCancelShare(currentShare.value.shareId);
  loading.value = false;
  if (!error) {
    window.$message?.success($t('page.disk.share.cancelSuccess'));
    emit('cancelShare', shareFile.value.fileId);
    currentShare.value = null;
    diskStore.closeShareDialog();
  }
}

// 权限标签映射
const permLabelMap: Record<string, string> = {
  DOWNLOAD: $t('page.disk.sharedWithMe.permDownload'),
  UPLOAD: $t('page.disk.share.permUpload'),
  PUT: $t('page.disk.share.permEdit'),
  DELETE: $t('page.disk.sharedWithMe.permDelete'),
  SHARE: $t('page.disk.sharedWithMe.permShare')
};
</script>

<template>
  <NModal
    v-model:show="diskStore.shareDialogVisible"
    preset="card"
    :title="$t('page.disk.share.configTitle')"
    style="width: 90%; max-width: 560px"
    :mask-closable="false"
    :bordered="false"
  >
    <div class="flex flex-col gap-16px">
      <!-- 文件信息 -->
      <div v-if="fileInfo" class="flex items-center gap-12px p-12px rounded bg-gray-50 dark:bg-gray-800">
        <FileIcon
          :file-type="fileInfo.type"
          :extension="fileInfo.extension"
          size="medium"
        />
        <div class="flex-1 min-w-0">
          <div class="text-14px font-medium truncate">{{ fileInfo.name }}</div>
          <div class="text-12px opacity-60">
            {{ fileInfo.type === 'folder' ? $t('page.disk.file.folder') : formatFileSize(fileInfo.size) }}
          </div>
        </div>
      </div>

      <!-- Share Type Tabs -->
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- Link Share Tab -->
        <NTabPane name="link" :tab="$t('page.disk.share.linkShare')">
          <!-- === 已有分享 — 管理界面 === -->
          <div v-if="hasExistingShare" class="flex flex-col gap-16px mt-4px">
            <!-- 第一行：右侧到期时间 -->
            <div class="flex justify-end items-center gap-8px">
              <span class="text-13px opacity-70 w-56px text-right">{{ $t('page.disk.share.expireTime') }}</span>
              <NDatePicker
                :value="editExpireTimestamp"
                type="date"
                size="small"
                style="width:140px"
                :disabled="updateLoading"
                @update:value="(val: number) => val && handleUpdateExpireDate(val)"
              />
            </div>

            <!-- 第二行：右侧分享形式下拉 -->
            <div class="flex justify-end items-center gap-8px">
              <span class="text-13px opacity-70 w-56px text-right">{{ $t('page.disk.share.shareForm') }}</span>
              <NSelect
                :value="editShareType"
                :options="shareFormOptions"
                size="small"
                style="width:140px"
                :disabled="updateLoading"
                @update:value="(val: 'public' | 'private') => handleUpdateShareType(val)"
              />
            </div>

            <!-- 第三行：分享链接输入组 + 二维码 -->
            <div class="bg-gray-100 dark:bg-gray-800 rounded">
              <NInputGroup>
                <NInput
                  :value="existingShareLink"
                  readonly
                  size="small"
                  style="width:90%"
                />
                <NPopover trigger="hover" placement="right">
                  <template #trigger>
                    <NButton size="small" style="width:10%">
                      <template #icon><SvgIcon icon="mdi:qrcode" :size="18" /></template>
                    </NButton>
                  </template>
                  <div v-if="qrCodeDataUrl" class="p-8px bg-white rounded">
                    <img :src="qrCodeDataUrl" alt="QR Code" class="w-128px h-128px block" />
                  </div>
                  <span v-else class="text-13px opacity-50">{{ $t('page.disk.share.qrCode') }}</span>
                </NPopover>
              </NInputGroup>
            </div>

            <!-- 第四行（仅私密）：提取码 -->
            <div v-if="editShareType === 'private' && currentShare?.extractionCode" class="flex items-center gap-8px">
              <span class="text-13px opacity-70">{{ $t('page.disk.share.extractionCode') }}</span>
              <span class="text-16px font-bold tracking-widest text-primary">{{ currentShare.extractionCode }}</span>
            </div>

            <!-- 第五行：操作权限标签（仅私密） -->
            <div v-if="editShareType === 'private' && currentShare?.operationPermissionList && currentShare.operationPermissionList.length > 0">
              <div class="text-13px opacity-70 mb-6px">{{ $t('page.disk.share.operationPermissions') }}</div>
              <div class="flex flex-wrap gap-6px">
                <NTag
                  v-for="perm in currentShare.operationPermissionList"
                  :key="perm"
                  size="small"
                  :bordered="false"
                  type="info"
                >
                  {{ permLabelMap[perm] || perm }}
                </NTag>
              </div>
            </div>

            <!-- 第六行：权限多选框（仅私密） -->
            <div v-if="editShareType === 'private'">
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.operationPermissions') }}</div>
              <div class="flex flex-wrap gap-16px">
                <NCheckbox
                  v-for="perm in editablePermissions"
                  :key="perm.value"
                  :checked="editPermissions.includes(perm.value)"
                  :disabled="updateLoading"
                  @update:checked="toggleEditPermission(perm.value)"
                >
                  {{ perm.label }}
                </NCheckbox>
              </div>
            </div>
          </div>

          <!-- === 未分享 — 创建界面 === -->
          <div v-else class="flex flex-col gap-16px">
            <!-- 有效期 -->
            <div>
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.validity') }}</div>
              <NTabs v-model:value="validity" type="segment" size="small">
                <NTabPane v-for="opt in validityOptions" :key="opt.value" :name="opt.value" :tab="opt.label" />
              </NTabs>
            </div>

            <!-- 分享形式 -->
            <div>
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.shareType') }}</div>
              <NTabs v-model:value="shareType" type="segment" size="small">
                <NTabPane v-for="opt in shareTypeOptions" :key="opt.value" :name="opt.value" :tab="opt.label" />
              </NTabs>
            </div>

            <!-- 提取码设置 -->
            <div v-if="isPrivate">
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.extractionCode') }}</div>
              <NTabs v-model:value="codeMode" type="segment" size="small">
                <NTabPane v-for="opt in codeModeOptions" :key="opt.value" :name="opt.value" :tab="opt.label" />
              </NTabs>

              <div v-if="codeMode === 'random'" class="flex items-center gap-12px mt-12px">
                <div class="flex-1 text-center">
                  <span class="inline-block px-16px py-8px text-18px font-bold tracking-widest rounded bg-primary/10 text-primary">
                    {{ randomCode }}
                  </span>
                </div>
                <NButton quaternary size="small" @click="randomCode = generateRandomCode()">
                  {{ $t('page.disk.share.regenerate') }}
                </NButton>
              </div>

              <div v-else class="mt-12px">
                <NInput
                  v-model:value="customCode"
                  :placeholder="$t('page.disk.share.extractionCode')"
                  :maxlength="4"
                  size="large"
                  class="text-center"
                  @input="customCode = customCode.replace(/[^a-zA-Z0-9]/g, '')"
                />
                <div v-if="customCode && !codeValid" class="text-12px text-error mt-4px">
                  {{ $t('page.disk.share.codeFormat') }}
                </div>
              </div>
            </div>

            <!-- 自定义地址 -->
            <div>
              <div class="flex items-center justify-between mb-8px">
                <span class="text-13px opacity-70">{{ $t('page.disk.share.customAddress') }}</span>
                <NSwitch v-model:value="customAddressEnabled" size="small" />
              </div>
              <div v-if="customAddressEnabled" class="flex items-center gap-8px">
                <span class="text-14px opacity-60 whitespace-nowrap">/s/</span>
                <NInput
                  v-model:value="customAddress"
                  :placeholder="$t('page.disk.share.customAddressPlaceholder')"
                  :maxlength="32"
                  class="flex-1 min-w-0"
                  @input="customAddress = customAddress.replace(/[^a-zA-Z0-9_-]/g, '')"
                />
              </div>
              <div v-if="customAddressEnabled && customAddress && !addressValid" class="text-12px text-error mt-4px">
                {{ $t('page.disk.share.addressFormat') }}
              </div>
              <div class="text-12px opacity-50 mt-8px">
                {{ $t('page.disk.share.linkPreview') }}: {{ shareLinkPreview }}
              </div>
            </div>
          </div>
        </NTabPane>

        <!-- Share to User Tab -->
        <NTabPane name="user" :tab="$t('page.disk.share.shareToUser')">
          <ShareToUser v-if="fileIdNum" :file-id="fileIdNum" />
        </NTabPane>

        <!-- Share to Dept Tab -->
        <NTabPane name="dept" :tab="$t('page.disk.share.shareToDept')">
          <ShareToDept v-if="fileIdNum" :file-id="fileIdNum" />
        </NTabPane>
      </NTabs>
    </div>

    <template #footer>
      <!-- 已分享状态 — 链接 Tab 按钮 -->
      <div v-if="hasExistingShare && activeTab === 'link'" class="flex justify-end gap-8px">
        <NButton type="error" :loading="loading" @click="handleCancelExistingShare">
          {{ $t('page.disk.share.cancelShare') }}
        </NButton>
        <NButton v-if="editShareType === 'private'" @click="handleCopyExistingCode">
          {{ $t('page.disk.share.copyCode') }}
        </NButton>
        <NButton type="primary" @click="handleCopyExistingLink">
          {{ $t('page.disk.share.copyLink') }}
        </NButton>
      </div>

      <!-- 未分享链接 Tab -->
      <div v-else-if="activeTab === 'link'" class="flex justify-end gap-8px">
        <NButton @click="handleCancel">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" :disabled="!canSubmit" @click="handleConfirm">
          {{ $t('page.disk.share.createShare') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
