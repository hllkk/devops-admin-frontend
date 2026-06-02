<script setup lang="ts">
import { ref, computed, watch, h } from 'vue';
import { $t } from '@/locales';
import { useDiskStore } from '@/store/modules/disk';
import { fetchCreateShare, fetchCancelShare, fetchUpdateShare } from '@/service/api/disk/share';
import { fetchCreateInternalShare, fetchGetFileShareTargets } from '@/service/api/disk/internal-share';
import { fetchGetUserSelect } from '@/service/api/system/user';
import { formatFileSize } from '@/utils/format';
import { handleCopy } from '@/utils/copy';
import DeptTree from '@/components/custom/dept-tree.vue';
import FileIcon from './file-icon.vue';
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

// 共享给用户
const selectedUsers = ref<number[]>([]);
interface UserOption {
  label: string;
  value: number;
  avatar?: string;
}
const userOptions = ref<UserOption[]>([]);
const userLoading = ref(false);
const userPermissionMap = ref<Record<number, string[]>>({});
const internalRemark = ref('');

// 已有共享目标
const existingTargets = ref<Api.Disk.FileShareTargetItem[]>([]);

// 共享给部门
const selectedDepts = ref<number[]>([]);
const deptOptions = ref<any[]>([]);
const deptPermissionMap = ref<Record<number, string[]>>({});

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

// 根据文件类型过滤可用权限（创建内部共享时）
const availablePermissions = computed(() => {
  const all = [
    { label: $t('page.disk.sharedWithMe.permDownload'), value: 'DOWNLOAD' },
    { label: $t('page.disk.sharedWithMe.permUpload'), value: 'UPLOAD' },
    { label: $t('page.disk.sharedWithMe.permEdit'), value: 'PUT' },
    { label: $t('page.disk.sharedWithMe.permDelete'), value: 'DELETE' }
  ];
  if (shareFile.value?.isFolder) return all;
  return all.filter(p => p.value !== 'UPLOAD');
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

const defaultNewUserPermissions = computed(() => {
  const perms = availablePermissions.value.map(p => p.value);
  return ['DOWNLOAD', ...perms.filter(p => p !== 'DOWNLOAD')].slice(0, 1);
});

const deptNameMap = computed(() => {
  const map: Record<number, string> = {};
  function walk(nodes: any[]) {
    for (const node of nodes) {
      if (node.id && node.label) {
        map[node.id] = node.label;
      }
      if (node.children) walk(node.children);
    }
  }
  walk(deptOptions.value);
  return map;
});

const existingUserTargets = computed(() =>
  existingTargets.value.filter(t => t.targetType === 'user')
);

const existingDeptTargets = computed(() =>
  existingTargets.value.filter(t => t.targetType === 'dept')
);

const filteredUserOptions = computed(() => {
  const excludeIds = new Set([
    ...selectedUsers.value,
    ...existingUserTargets.value.map(t => t.targetId)
  ]);
  return userOptions.value.filter(u => !excludeIds.has(u.value));
});

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

const userOptionMap = computed(() => {
  const map: Record<number, UserOption> = {};
  userOptions.value.forEach(u => {
    map[u.value] = u;
  });
  return map;
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

async function loadUserOptions() {
  if (userOptions.value.length > 0) return;
  userLoading.value = true;
  const { data } = await fetchGetUserSelect();
  if (data) {
    userOptions.value = data.map(u => ({
      label: u.nickName ? `${u.nickName}（${u.userName}）` : u.userName,
      value: u.userId as number,
      avatar: u.avatar
    }));
  }
  userLoading.value = false;
}

function getUserAvatar(option: UserOption) {
  return h('img', {
    src: option.avatar || '',
    style: 'width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#e5e7eb;'
  });
}

function getUserDefaultAvatar(label: string) {
  const initial = label.charAt(0).toUpperCase();
  return h(
    'span',
    {
      style:
        'width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:#e5e7eb;flex-shrink:0;'
    },
    initial
  );
}

function renderUserLabel(option: UserOption) {
  const avatar = option.avatar ? getUserAvatar(option) : getUserDefaultAvatar(option.label);
  return h('div', { style: 'display:flex;align-items:center;gap:8px;' }, [avatar, option.label]);
}

function toggleUserPermission(userId: number, perm: string) {
  const current = userPermissionMap.value[userId] || [];
  if (current.includes(perm)) {
    userPermissionMap.value = {
      ...userPermissionMap.value,
      [userId]: current.filter(p => p !== perm)
    };
  } else {
    userPermissionMap.value = {
      ...userPermissionMap.value,
      [userId]: [...current, perm]
    };
  }
}

function removeUser(userId: number) {
  selectedUsers.value = selectedUsers.value.filter(id => id !== userId);
  const updated = { ...userPermissionMap.value };
  const { [userId]: _, ...rest } = updated;
  userPermissionMap.value = rest;
}

function setAllUsersPermission(perm: string, checked: boolean) {
  const updated = { ...userPermissionMap.value };
  for (const userId of selectedUsers.value) {
    const current = updated[userId] || [];
    if (checked && !current.includes(perm)) {
      updated[userId] = [...current, perm];
    } else if (!checked) {
      updated[userId] = current.filter(p => p !== perm);
    }
  }
  userPermissionMap.value = updated;
}

function toggleDeptPermission(deptId: number, perm: string) {
  const current = deptPermissionMap.value[deptId] || [];
  if (current.includes(perm)) {
    deptPermissionMap.value = {
      ...deptPermissionMap.value,
      [deptId]: current.filter(p => p !== perm)
    };
  } else {
    deptPermissionMap.value = {
      ...deptPermissionMap.value,
      [deptId]: [...current, perm]
    };
  }
}

function setAllDeptsPermission(perm: string, checked: boolean) {
  const updated = { ...deptPermissionMap.value };
  for (const deptId of selectedDepts.value) {
    const current = updated[deptId] || [];
    if (checked && !current.includes(perm)) {
      updated[deptId] = [...current, perm];
    } else if (!checked) {
      updated[deptId] = current.filter(p => p !== perm);
    }
  }
  deptPermissionMap.value = updated;
}

const canSubmit = computed(() => {
  if (!shareFile.value) return false;
  if (activeTab.value === 'link' && hasExistingShare.value) return false;
  if (activeTab.value === 'link') return formValid.value;
  if (activeTab.value === 'user') {
    if (selectedUsers.value.length === 0) return false;
    return selectedUsers.value.every(uid => (userPermissionMap.value[uid] || []).length > 0);
  }
  if (activeTab.value === 'dept') {
    if (selectedDepts.value.length === 0) return false;
    return selectedDepts.value.every(did => (deptPermissionMap.value[did] || []).length > 0);
  }
  return false;
});

// 加载已有共享目标
async function loadExistingTargets() {
  if (!shareFile.value) return;
  const fileIdNum = typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10)
    : shareFile.value.fileId;
  const { data } = await fetchGetFileShareTargets(fileIdNum);
  if (data) {
    existingTargets.value = data;
  }
}

watch(() => diskStore.shareDialogVisible, async visible => {
  if (visible) {
    validity.value = '7';
    shareType.value = 'public';
    codeMode.value = 'random';
    randomCode.value = generateRandomCode();
    customCode.value = '';
    customAddressEnabled.value = false;
    customAddress.value = '';
    selectedUsers.value = [];
    selectedDepts.value = [];
    userPermissionMap.value = {};
    deptPermissionMap.value = {};
    internalRemark.value = '';
    existingTargets.value = [];
    activeTab.value = 'link';
    loadUserOptions();
    loadExistingTargets();
  }
});

watch(activeTab, tab => {
  if (tab === 'user') {
    loadUserOptions();
  }
});

watch(selectedUsers, (newVal, oldVal) => {
  const added = newVal.filter(id => !oldVal?.includes(id));
  if (added.length > 0) {
    const updated = { ...userPermissionMap.value };
    const defaultPerms = defaultNewUserPermissions.value;
    for (const id of added) {
      if (!updated[id] || updated[id].length === 0) {
        updated[id] = [...defaultPerms];
      }
    }
    userPermissionMap.value = updated;
  }
}, { deep: true });

watch(selectedDepts, (newVal, oldVal) => {
  const added = newVal.filter(id => !oldVal?.includes(id));
  if (added.length > 0) {
    const updated = { ...deptPermissionMap.value };
    const defaultPerms = defaultNewUserPermissions.value;
    for (const id of added) {
      if (!updated[id] || updated[id].length === 0) {
        updated[id] = [...defaultPerms];
      }
    }
    deptPermissionMap.value = updated;
  }
}, { deep: true });

function handleCancel() {
  diskStore.closeShareDialog();
}

async function handleConfirm() {
  if (activeTab.value === 'link') {
    await handleLinkShare();
  } else if (activeTab.value === 'user') {
    await handleUserShare();
  } else if (activeTab.value === 'dept') {
    await handleDeptShare();
  }
}

async function handleLinkShare() {
  if (!formValid.value || !shareFile.value) return;
  loading.value = true;
  const fileIdNum = typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10)
    : shareFile.value.fileId;
  const params: Api.Disk.CreateShareParams = {
    fileId: fileIdNum,
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
    diskStore.closeShareDialog();
  }
}

async function handleUserShare() {
  if (!shareFile.value || selectedUsers.value.length === 0) return;
  loading.value = true;
  const fileIdNum = typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10) : shareFile.value.fileId;
  const targets = selectedUsers.value.map(uid => ({
    targetId: uid,
    permissions: userPermissionMap.value[uid] || ['DOWNLOAD']
  }));
  const { error } = await fetchCreateInternalShare({
    fileId: fileIdNum,
    shareType: 'user',
    targets,
    remark: internalRemark.value
  });
  loading.value = false;
  if (!error) {
    window.$message?.success($t('page.disk.share.shareSuccess'));
    diskStore.closeShareDialog();
  }
}

async function handleDeptShare() {
  if (!shareFile.value || selectedDepts.value.length === 0) return;
  loading.value = true;
  const fileIdNum = typeof shareFile.value.fileId === 'string'
    ? parseInt(shareFile.value.fileId, 10) : shareFile.value.fileId;
  const targets = selectedDepts.value.map(did => ({
    targetId: did,
    permissions: deptPermissionMap.value[did] || ['DOWNLOAD']
  }));
  const { error } = await fetchCreateInternalShare({
    fileId: fileIdNum,
    shareType: 'dept',
    targets,
    remark: internalRemark.value
  });
  loading.value = false;
  if (!error) {
    window.$message?.success($t('page.disk.share.shareSuccess'));
    diskStore.closeShareDialog();
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
          <div class="flex flex-col gap-12px mt-8px">
            <!-- 已有共享用户展示 -->
            <div v-if="existingUserTargets.length > 0" class="mb-4px">
              <div class="text-12px opacity-50 mb-6px">{{ $t('page.disk.share.sharedUsers') }}</div>
              <div class="flex flex-wrap gap-8px">
                <div
                  v-for="target in existingUserTargets"
                  :key="target.targetId"
                  class="flex items-center gap-6px px-8px py-4px rounded-full bg-primary/10 text-13px"
                >
                  <img
                    v-if="userOptionMap[target.targetId]?.avatar"
                    :src="userOptionMap[target.targetId]!.avatar"
                    class="w-20px h-20px rd-full object-cover shrink-0 bg-gray-200"
                  />
                  <div v-else class="w-20px h-20px rd-full bg-primary/20 text-primary flex items-center justify-center text-11px shrink-0">
                    {{ (target.targetName || '?').charAt(0) }}
                  </div>
                  <span class="max-w-80px truncate">{{ target.targetName }}</span>
                  <div class="flex gap-2px">
                    <NTag
                      v-for="p in target.permissions"
                      :key="p"
                      size="tiny"
                      :bordered="false"
                      class="text-10px!"
                    >
                      {{ permLabelMap[p] || p }}
                    </NTag>
                  </div>
                </div>
              </div>
            </div>

            <!-- 选择新用户 -->
            <div>
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.addUser') }}</div>
              <NSelect
                v-model:value="selectedUsers"
                :options="filteredUserOptions"
                :loading="userLoading"
                :render-label="renderUserLabel"
                multiple
                filterable
                :placeholder="$t('page.disk.share.searchUser')"
                :max-tag-count="0"
              />
            </div>

            <!-- 新选用户头像展示 -->
            <div v-if="selectedUsers.length > 0" class="flex flex-wrap gap-8px">
              <div
                v-for="userId in selectedUsers"
                :key="userId"
                class="flex items-center gap-6px px-8px py-4px rounded-full bg-gray-100 dark:bg-gray-700 text-13px group"
              >
                <img
                  v-if="userOptionMap[userId]?.avatar"
                  :src="userOptionMap[userId]!.avatar"
                  class="w-20px h-20px rd-full object-cover shrink-0 bg-gray-200"
                />
                <div v-else class="w-20px h-20px rd-full bg-primary/20 text-primary flex items-center justify-center text-11px shrink-0">
                  {{ (userOptionMap[userId]?.label || '?').charAt(0) }}
                </div>
                <span class="max-w-80px truncate">{{ userOptionMap[userId]?.label || userId }}</span>
                <button
                  class="w-16px h-16px flex items-center justify-center rounded-full opacity-40 hover:opacity-100 hover:bg-error/20 hover:text-error transition shrink-0"
                  @click="removeUser(userId)"
                >
                  <SvgIcon icon="mdi:close" :size="12" />
                </button>
              </div>
            </div>

            <!-- 逐用户权限配置表 -->
            <div v-if="selectedUsers.length > 0">
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.permissions') }}</div>

              <!-- 批量操作栏 -->
              <div class="flex items-center gap-8px mb-8px">
                <span class="text-12px opacity-50">{{ $t('page.disk.share.batchSet') }}:</span>
                <NButton
                  v-for="perm in availablePermissions"
                  :key="perm.value"
                  size="tiny"
                  quaternary
                  @click="setAllUsersPermission(perm.value, true)"
                >
                  {{ $t('page.disk.share.all') }}{{ perm.label }}
                </NButton>
              </div>

              <!-- 权限表格 -->
              <div class="border rounded dark:border-gray-700 overflow-hidden">
                <div class="max-h-240px overflow-y-auto">
                  <table class="w-full text-13px">
                    <thead class="sticky top-0 z-1">
                      <tr class="bg-gray-50 dark:bg-gray-800">
                        <th class="text-left px-12px py-8px font-medium">{{ $t('page.disk.share.user') }}</th>
                        <th v-for="perm in availablePermissions" :key="perm.value" class="text-center px-8px py-8px font-medium w-64px">
                          {{ perm.label }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="userId in selectedUsers"
                        :key="userId"
                        class="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td class="px-12px py-8px">
                          <div class="flex items-center gap-8px">
                            <img
                              v-if="userOptionMap[userId]?.avatar"
                              :src="userOptionMap[userId]!.avatar"
                              class="w-22px h-22px rd-full object-cover shrink-0 bg-gray-200"
                            />
                            <div v-else class="w-22px h-22px rd-full bg-primary/10 text-primary flex items-center justify-center text-12px shrink-0">
                              {{ (userOptionMap[userId]?.label || '?').charAt(0) }}
                            </div>
                            <span class="truncate max-w-120px">{{ userOptionMap[userId]?.label || userId }}</span>
                          </div>
                        </td>
                        <td v-for="perm in availablePermissions" :key="perm.value" class="text-center px-8px py-8px">
                          <NCheckbox
                            :checked="(userPermissionMap[userId] || []).includes(perm.value)"
                            @update:checked="toggleUserPermission(userId, perm.value)"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.remark') }}</div>
              <NInput v-model:value="internalRemark" type="textarea" :placeholder="$t('page.disk.share.remarkPlaceholder')" :rows="2" :maxlength="200" />
            </div>
          </div>
        </NTabPane>

        <!-- Share to Dept Tab -->
        <NTabPane name="dept" :tab="$t('page.disk.share.shareToDept')">
          <div class="flex flex-col gap-12px mt-8px">
            <!-- 已有共享部门展示 -->
            <div v-if="existingDeptTargets.length > 0" class="mb-4px">
              <div class="text-12px opacity-50 mb-6px">{{ $t('page.disk.share.sharedDepts') }}</div>
              <div class="flex flex-wrap gap-8px">
                <div
                  v-for="target in existingDeptTargets"
                  :key="target.targetId"
                  class="flex items-center gap-6px px-8px py-4px rounded-full bg-blue-500/10 text-13px"
                >
                  <SvgIcon icon="mdi:office-building" :size="14" class="shrink-0 opacity-60" />
                  <span class="max-w-100px truncate">{{ target.targetName }}</span>
                  <div class="flex gap-2px">
                    <NTag
                      v-for="p in target.permissions"
                      :key="p"
                      size="tiny"
                      :bordered="false"
                      class="text-10px!"
                    >
                      {{ permLabelMap[p] || p }}
                    </NTag>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.selectDept') }}</div>
              <DeptTree v-model:value="selectedDepts" v-model:options="deptOptions" :immediate="true" />
            </div>

            <!-- 逐部门权限配置表 -->
            <div v-if="selectedDepts.length > 0">
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.permissions') }}</div>

              <!-- 批量操作栏 -->
              <div class="flex items-center gap-8px mb-8px">
                <span class="text-12px opacity-50">{{ $t('page.disk.share.batchSet') }}:</span>
                <NButton
                  v-for="perm in availablePermissions"
                  :key="perm.value"
                  size="tiny"
                  quaternary
                  @click="setAllDeptsPermission(perm.value, true)"
                >
                  {{ $t('page.disk.share.all') }}{{ perm.label }}
                </NButton>
              </div>

              <!-- 权限表格 -->
              <div class="border rounded dark:border-gray-700 overflow-hidden">
                <table class="w-full text-13px">
                  <thead>
                    <tr class="bg-gray-50 dark:bg-gray-800">
                      <th class="text-left px-12px py-8px font-medium">{{ $t('page.disk.share.dept') }}</th>
                      <th v-for="perm in availablePermissions" :key="perm.value" class="text-center px-8px py-8px font-medium w-64px">
                        {{ perm.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="deptId in selectedDepts"
                      :key="deptId"
                      class="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td class="px-12px py-8px">
                        <div class="flex items-center gap-8px">
                          <SvgIcon icon="mdi:office-building" :size="18" class="shrink-0 opacity-60" />
                          <span class="truncate">{{ deptNameMap[deptId] || deptId }}</span>
                        </div>
                      </td>
                      <td v-for="perm in availablePermissions" :key="perm.value" class="text-center px-8px py-8px">
                        <NCheckbox
                          :checked="(deptPermissionMap[deptId] || []).includes(perm.value)"
                          @update:checked="toggleDeptPermission(deptId, perm.value)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div class="text-13px opacity-70 mb-8px">{{ $t('page.disk.share.remark') }}</div>
              <NInput v-model:value="internalRemark" type="textarea" :placeholder="$t('page.disk.share.remarkPlaceholder')" :rows="2" :maxlength="200" />
            </div>
          </div>
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

      <!-- 未分享状态 / 其他 Tab -->
      <div v-else class="flex justify-end gap-8px">
        <NButton @click="handleCancel">{{ $t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" :disabled="!canSubmit" @click="handleConfirm">
          {{ $t('page.disk.share.createShare') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
