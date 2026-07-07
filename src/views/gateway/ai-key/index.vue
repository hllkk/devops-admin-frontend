<script setup lang="tsx">
import { ref } from 'vue';
import { NButton, NDivider, NPopconfirm, NTag } from 'naive-ui';
import { fetchCreateAiKey, fetchDeleteAiKey, fetchGetAiKeyIdentityList, fetchToggleAiKey, fetchUpdateAiKey } from '@/service/api/gateway';

defineOptions({
  name: 'GatewayAiKeyList'
});

interface IdentityItem {
  user: { id: number; username: string; displayName: string; departmentName: string };
  mainKey: Api.Gateway.AiKey | null;
  sceneKeys: Api.Gateway.AiKey[];
}

const searchKeyword = ref('');
const activeTab = ref('user');
const isLoading = ref(false);
const items = ref<IdentityItem[]>([]);
const expandedRows = ref<Set<string>>(new Set());
const revealedKeys = ref<Set<number>>(new Set());

// 抽屉控制
const showFormDrawer = ref(false);
const isEditing = ref(false);
const editingKey = ref<Api.Gateway.AiKey | null>(null);
const formTargetUserId = ref(0);
const formSubmitting = ref(false);

// 表单字段
const formName = ref('');
const formDescription = ref('');
const formModels = ref('');
const formBudgetLimit = ref('');
const formTpmLimit = ref<number | null>(null);
const formRpmLimit = ref<number | null>(null);
const formError = ref('');

const tabs = [
  { label: '用户', value: 'user' },
  // TODO Phase 2: 部门/项目 tab
];

async function loadData() {
  isLoading.value = true;
  try {
    const res = await fetchGetAiKeyIdentityList({
      tab: activeTab.value,
      keyword: searchKeyword.value || undefined,
      pageNum: 1,
      pageSize: 100
    });
    if (res.data) {
      items.value = (res.data.rows || []) as IdentityItem[];
    }
  } finally {
    isLoading.value = false;
  }
}

function toggleExpand(userId: string) {
  const next = new Set(expandedRows.value);
  if (next.has(userId)) next.delete(userId);
  else next.add(userId);
  expandedRows.value = next;
}

function toggleReveal(keyId: number) {
  const next = new Set(revealedKeys.value);
  if (next.has(keyId)) next.delete(keyId);
  else next.add(keyId);
  revealedKeys.value = next;
}

function maskKey(key: string) {
  if (!key || key.length <= 8) return key;
  return key.slice(0, 4) + '****' + key.slice(-4);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    window.$message?.success('已复制');
  } catch {
    window.$message?.error('复制失败');
  }
}

function handleCreateForUser(userId: number) {
  isEditing.value = false;
  formTargetUserId.value = userId;
  editingKey.value = null;
  formName.value = '';
  formDescription.value = '';
  formModels.value = '';
  formBudgetLimit.value = '';
  formTpmLimit.value = null;
  formRpmLimit.value = null;
  formError.value = '';
  showFormDrawer.value = true;
}

function handleEdit(key: Api.Gateway.AiKey) {
  isEditing.value = true;
  editingKey.value = key;
  formName.value = key.name;
  formDescription.value = key.description;
  formModels.value = key.models.join(', ');
  formBudgetLimit.value = key.budgetLimit || '';
  formTpmLimit.value = key.tpmLimit;
  formRpmLimit.value = key.rpmLimit;
  formError.value = '';
  showFormDrawer.value = true;
}

async function handleSubmit() {
  if (!formName.value.trim()) {
    formError.value = '请输入 Key 名称';
    return;
  }
  formError.value = '';
  formSubmitting.value = true;
  try {
    const models = formModels.value
      ? formModels.value.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    if (isEditing.value && editingKey.value) {
      await fetchUpdateAiKey({
        id: editingKey.value.id,
        name: formName.value,
        ownerType: editingKey.value.ownerType,
        ownerId: editingKey.value.ownerId,
        description: formDescription.value,
        models,
        budgetLimit: formBudgetLimit.value || null,
        tpmLimit: formTpmLimit.value,
        rpmLimit: formRpmLimit.value
      });
    } else {
      await fetchCreateAiKey({
        name: formName.value,
        ownerType: 'user',
        ownerId: formTargetUserId.value,
        keyType: 'personal_main',
        description: formDescription.value,
        models,
        budgetLimit: formBudgetLimit.value || null,
        tpmLimit: formTpmLimit.value,
        rpmLimit: formRpmLimit.value
      });
    }
    showFormDrawer.value = false;
    await loadData();
  } catch {
    formError.value = '操作失败';
  } finally {
    formSubmitting.value = false;
  }
}

async function handleToggle(key: Api.Gateway.AiKey) {
  await fetchToggleAiKey(key.id);
  await loadData();
}

async function handleDelete(keyId: number) {
  await fetchDeleteAiKey(keyId);
  await loadData();
}

function handleTabChange(tab: string) {
  activeTab.value = tab;
  loadData();
}

function handleSearch() {
  loadData();
}

loadData();
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px overflow-hidden lt-sm:overflow-auto">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-800">AI 身份管理</h1>
      <div class="flex items-center gap-3">
        <!-- <NButton @click="showScenarioDialog = true">场景管理</NButton> -->
        <!-- <NButton type="primary" @click="showBatchResource = true">批量设置</NButton> -->
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-1 rounded-xl bg-white/50 p-1">
      <NButton
        v-for="tab in tabs"
        :key="tab.value"
        size="small"
        :type="activeTab === tab.value ? 'primary' : 'default'"
        :quaternary="activeTab !== tab.value"
        @click="handleTabChange(tab.value)"
      >
        {{ tab.label }}
      </NButton>
    </div>

    <!-- 搜索栏 -->
    <div class="flex items-center gap-3">
      <NInput
        v-model:value="searchKeyword"
        clearable
        placeholder="搜索用户..."
        style="width: 240px"
        @keyup.enter="handleSearch"
      />
      <NButton @click="handleSearch">搜索</NButton>
    </div>

    <!-- 表格 -->
    <div class="flex-1 overflow-hidden">
      <div v-if="isLoading" class="flex-center py-20">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
      <div v-else-if="items.length === 0" class="flex-center py-20 text-sm text-slate-400">
        暂无数据
      </div>
      <div v-else class="h-full overflow-y-auto rounded-xl border border-slate-200 bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th class="w-10 px-4 py-3" />
              <th class="px-4 py-3 font-medium">用户</th>
              <th class="px-4 py-3 font-medium">Key</th>
              <th class="px-4 py-3 font-medium">模型</th>
              <th class="px-4 py-3 font-medium">预算</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in items" :key="item.user.id">
              <tr class="border-b border-slate-100 hover:bg-slate-50/50">
                <td class="px-4 py-3">
                  <NButton
                    v-if="(item.sceneKeys || []).length > 0"
                    text
                    size="tiny"
                    @click="toggleExpand(String(item.user.id))"
                  >
                    <span
                      class="text-lg transition-transform inline-block"
                      :class="expandedRows.has(String(item.user.id)) ? 'rotate-90' : ''"
                    >›</span>
                  </NButton>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-800">{{ item.user.displayName || item.user.username }}</div>
                  <div class="text-xs text-slate-400">{{ item.user.departmentName || '-' }}</div>
                </td>
                <td class="px-4 py-3">
                  <div v-if="item.mainKey?.litellmKeyId" class="flex items-center gap-1">
                    <code class="text-xs text-slate-600 font-mono">{{
                      revealedKeys.has(item.mainKey.id) ? item.mainKey.litellmKeyId : maskKey(item.mainKey.litellmKeyId)
                    }}</code>
                    <NButton text size="tiny" @click="toggleReveal(item.mainKey!.id)">
                      <span class="text-slate-400 hover:text-slate-600 text-sm">{{ revealedKeys.has(item.mainKey.id) ? '👁' : '👁‍🗨' }}</span>
                    </NButton>
                    <NButton text size="tiny" @click="copyToClipboard(item.mainKey!.litellmKeyId)">
                      <span class="text-slate-400 hover:text-slate-600 text-sm">📋</span>
                    </NButton>
                  </div>
                  <span v-else class="text-xs text-slate-400">-</span>
                </td>
                <td class="px-4 py-3">
                  <div v-if="item.mainKey?.models?.length" class="flex flex-wrap gap-1">
                    <NTag v-for="m in item.mainKey.models.slice(0, 3)" :key="m" size="tiny" :bordered="false">
                      {{ m }}
                    </NTag>
                    <NTag v-if="item.mainKey.models.length > 3" size="tiny" :bordered="false">
                      +{{ item.mainKey.models.length - 3 }}
                    </NTag>
                  </div>
                  <span v-else class="text-xs text-slate-400">无</span>
                </td>
                <td class="px-4 py-3">
                  <div v-if="item.mainKey?.budgetLimit" class="text-xs">
                    <span class="text-slate-800">{{ item.mainKey.budgetLimit }}</span>
                    <span class="text-slate-400"> / {{ item.mainKey.budgetUsed || '0' }} 已用</span>
                  </div>
                  <span v-else class="text-xs text-slate-400">不限额</span>
                  <div v-if="item.mainKey?.tpmLimit || item.mainKey?.rpmLimit" class="text-xs text-slate-400 mt-1">
                    <template v-if="item.mainKey.tpmLimit">TPM: {{ item.mainKey.tpmLimit }}</template>
                    <template v-if="item.mainKey.tpmLimit && item.mainKey.rpmLimit"> · </template>
                    <template v-if="item.mainKey.rpmLimit">RPM: {{ item.mainKey.rpmLimit }}</template>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <NButton
                    v-if="item.mainKey"
                    size="tiny"
                    :type="item.mainKey.isActive ? 'success' : 'default'"
                    secondary
                    round
                    @click="handleToggle(item.mainKey)"
                  >
                    {{ item.mainKey.isActive ? '已启用' : '已禁用' }}
                  </NButton>
                  <span v-else class="text-xs text-slate-400">未创建</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <NButton
                      v-if="item.mainKey"
                      text
                      size="tiny"
                      type="primary"
                      @click="handleEdit(item.mainKey!)"
                    >
                      编辑
                    </NButton>
                    <NButton
                      size="tiny"
                      text
                      type="primary"
                      @click="handleCreateForUser(item.user.id)"
                    >
                      +场景Key
                    </NButton>
                    <template v-if="item.mainKey">
                      <NDivider vertical />
                      <NPopconfirm @positive-click="() => handleDelete(item.mainKey!.id)">
                        <template #trigger>
                          <NButton text size="tiny" type="error">删除</NButton>
                        </template>
                        确定删除该 Key？
                      </NPopconfirm>
                    </template>
                  </div>
                </td>
              </tr>
              <!-- 展开场景 Key -->
              <template v-if="expandedRows.has(String(item.user.id))">
                <tr v-for="sk in item.sceneKeys" :key="sk.id" class="border-b border-slate-100 bg-slate-50/30">
                  <td class="px-4 py-3" />
                  <td class="px-4 py-2">
                    <div class="text-xs text-slate-500 ml-4">└ 场景 Key</div>
                  </td>
                  <td class="px-4 py-2">
                    <code class="text-xs text-slate-500">{{ sk.name }}</code>
                  </td>
                  <td class="px-4 py-2">
                    <div v-if="sk.models?.length" class="flex flex-wrap gap-1">
                      <NTag v-for="m in sk.models.slice(0, 2)" :key="m" size="tiny" :bordered="false">
                        {{ m }}
                      </NTag>
                    </div>
                    <span v-else class="text-xs text-slate-400">-</span>
                  </td>
                  <td class="px-4 py-2">
                    <span class="text-xs text-slate-400">{{ sk.budgetLimit || '不限额' }}</span>
                  </td>
                  <td class="px-4 py-2">
                    <NTag size="tiny" :type="sk.isActive ? 'success' : 'default'" :bordered="false">
                      {{ sk.isActive ? '启用' : '禁用' }}
                    </NTag>
                  </td>
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-2">
                      <NButton text size="tiny" type="primary" @click="handleEdit(sk)">编辑</NButton>
                      <NPopconfirm @positive-click="() => handleDelete(sk.id)">
                        <template #trigger>
                          <NButton text size="tiny" type="error">删除</NButton>
                        </template>
                        确定删除该 Key？
                      </NPopconfirm>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 创建/编辑 Key 抽屉：使用 NModal 代替(简化) -->
    <NModal
      v-model:show="showFormDrawer"
      preset="card"
      :title="isEditing ? '编辑 AI Key' : '创建 AI Key'"
      style="width: 560px"
    >
      <div class="flex-col-stretch gap-16px max-h-[60vh] overflow-y-auto">
        <div>
          <label class="mb-1 block text-sm font-medium">名称</label>
          <NInput v-model:value="formName" placeholder="Key 名称" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">描述</label>
          <NInput v-model:value="formDescription" type="textarea" :rows="2" placeholder="描述" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">可用模型（逗号分隔）</label>
          <NInput v-model:value="formModels" placeholder="gpt-4, claude-3.5-sonnet" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">预算上限（空=不限）</label>
          <NInput v-model:value="formBudgetLimit" placeholder="100.00" />
        </div>
        <div class="flex gap-4">
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium">TPM 限额</label>
            <NInput
              :value="formTpmLimit !== null ? String(formTpmLimit) : ''"
              placeholder="TPM"
              @update:value="(v: string) => formTpmLimit = v ? Number(v) : null"
            />
          </div>
          <div class="flex-1">
            <label class="mb-1 block text-sm font-medium">RPM 限额</label>
            <NInput
              :value="formRpmLimit !== null ? String(formRpmLimit) : ''"
              placeholder="RPM"
              @update:value="(v: string) => formRpmLimit = v ? Number(v) : null"
            />
          </div>
        </div>
        <div v-if="formError" class="text-sm text-red-500">{{ formError }}</div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showFormDrawer = false">取消</NButton>
          <NButton type="primary" :loading="formSubmitting" @click="handleSubmit">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
