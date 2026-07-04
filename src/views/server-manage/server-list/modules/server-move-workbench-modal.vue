<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NDataTable, NEmpty, NModal, NRadio, NRadioGroup, NSpace, NTree } from 'naive-ui';
import type { DataTableColumns, TreeOption } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchGetGroupTree, fetchGetServerList, fetchMoveServers } from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerMoveWorkbenchModal' });

interface Props {
  /** 进入时默认浏览的分组；0/undefined 表示不预选 */
  defaultGroupId?: CommonType.IdType;
}
const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}
const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', { default: false });

const { bool: loading, setTrue: startLoading, setFalse: endLoading } = useBoolean();
const { bool: submitting, setTrue: startSubmitting, setFalse: endSubmitting } = useBoolean();

const step = ref<1 | 2>(1);
const groupTree = ref<Api.Server.ServerGroup[]>([]);
const expandedKeys = ref<CommonType.IdType[]>([]);
const browsedGroupId = ref<CommonType.IdType | null>(null);
const servers = ref<Api.Server.Server[]>([]);
const selectedServerIds = ref<CommonType.IdType[]>([]);
const targetGroupId = ref<CommonType.IdType | null>(null);

/** 目标分组扁平（仅真实分组 id>0，带层级缩进） */
const targetOptions = computed(() => {
  const flat: { id: CommonType.IdType; name: string }[] = [];
  const walk = (nodes: Api.Server.ServerGroup[], depth: number) => {
    nodes.forEach(n => {
      if (n.id !== 0) flat.push({ id: n.id, name: `${'——'.repeat(depth)} ${n.name}` });
      if (n.children?.length) walk(n.children, depth + 1);
    });
  };
  walk(groupTree.value, 0);
  return flat;
});

/** 当前浏览分组中已被选中的主机（供 NDataTable 回显） */
const currentGroupChecked = computed(() =>
  servers.value.filter(s => selectedServerIds.value.includes(s.id)).map(s => s.id)
);

function rowKey(row: Api.Server.Server): CommonType.IdType {
  return row.id;
}

function updateExpandedKeys(keys: CommonType.IdType[]) {
  expandedKeys.value = keys;
}

const columns = computed<DataTableColumns<Api.Server.Server>>(() => [
  { type: 'selection' },
  { key: 'name', title: $t('page.server.serverList.name') },
  { key: 'ip', title: $t('page.server.serverList.ip') },
  { key: 'os', title: $t('page.server.serverList.os') }
]);

async function loadGroupTree() {
  const { data } = await fetchGetGroupTree();
  if (data) {
    groupTree.value = data;
    expandedKeys.value = data.map(g => g.id);
  }
}

async function loadServers(groupId: CommonType.IdType) {
  startLoading();
  const { data, error } = await fetchGetServerList({
    groupId,
    includeSubGroups: false,
    pageNum: 1,
    pageSize: 9999,
    name: null,
    ip: null,
    status: null,
    os: null,
    params: {}
  });
  endLoading();
  servers.value = !error && data ? data.rows : [];
}

function selectGroup(keys: CommonType.IdType[]) {
  const id = keys[0];
  if (id == null) return;
  browsedGroupId.value = id;
  loadServers(id);
}

/** 跨分组勾选累积：保留其它分组已选，合并当前分组最新勾选 */
function updateChecked(keys: CommonType.IdType[]) {
  const currentIds = servers.value.map(s => s.id);
  const others = selectedServerIds.value.filter(id => !currentIds.includes(id));
  selectedServerIds.value = [...others, ...keys];
}

function gotoStep2() {
  if (selectedServerIds.value.length === 0) return;
  targetGroupId.value = null;
  step.value = 2;
}

async function confirmMove() {
  if (targetGroupId.value == null) return;
  startSubmitting();
  const { error } = await fetchMoveServers({
    ids: selectedServerIds.value,
    targetGroupId: targetGroupId.value
  });
  endSubmitting();
  if (error) {
    window.$message?.error(error.message);
    return;
  }
  window.$message?.success($t('page.server.move.success'));
  visible.value = false;
  emit('submitted');
}

function reset() {
  step.value = 1;
  browsedGroupId.value = null;
  servers.value = [];
  selectedServerIds.value = [];
  targetGroupId.value = null;
}

watch(visible, val => {
  if (!val) return;
  reset();
  loadGroupTree().then(() => {
    if (props.defaultGroupId && props.defaultGroupId !== 0) {
      browsedGroupId.value = props.defaultGroupId;
      loadServers(props.defaultGroupId);
    }
  });
});
</script>

<template>
  <NModal v-model:show="visible" preset="card" :title="$t('page.server.move.title')" :style="{ width: '760px' }">
    <!-- 步骤 1：选主机 -->
    <div v-if="step === 1" class="flex flex-col gap-8px">
      <div class="text-13px font-medium">{{ $t('page.server.move.step1Title') }}</div>
      <div class="flex gap-12px lt-sm:flex-col" style="height: 360px">
        <div class="w-200px overflow-auto lt-sm:w-full">
          <NTree
            :data="groupTree as unknown as TreeOption[]"
            :selected-keys="browsedGroupId == null ? [] : [browsedGroupId]"
            :expanded-keys="expandedKeys"
            key-field="id"
            label-field="name"
            block-line
            @update:selected-keys="selectGroup"
            @update:expanded-keys="updateExpandedKeys"
          />
        </div>
        <div class="flex-1 overflow-auto">
          <NDataTable
            v-if="browsedGroupId != null"
            :columns="columns"
            :data="servers"
            :loading="loading"
            :row-key="rowKey"
            :checked-row-keys="currentGroupChecked"
            size="small"
            @update:checked-row-keys="updateChecked"
          />
          <NEmpty v-else :description="$t('page.server.move.selectGroup')" class="py-40px" />
        </div>
      </div>
    </div>
    <!-- 步骤 2：选目标分组 -->
    <div v-else class="flex flex-col gap-8px">
      <div class="text-13px font-medium">{{ $t('page.server.move.step2Title') }}</div>
      <div class="overflow-auto" style="max-height: 360px">
        <NRadioGroup v-model:value="targetGroupId" name="targetGroup">
          <NSpace vertical>
            <NRadio v-for="g in targetOptions" :key="g.id" :value="g.id">{{ g.name }}</NRadio>
          </NSpace>
        </NRadioGroup>
      </div>
    </div>
    <template #footer>
      <NSpace justify="end" align="center">
        <span v-if="step === 1" class="text-12px opacity-70">
          {{ $t('page.server.move.selected', { count: selectedServerIds.length }) }}
        </span>
        <template v-if="step === 1">
          <NButton @click="visible = false">{{ $t('page.server.move.cancel') }}</NButton>
          <NButton type="primary" :disabled="selectedServerIds.length === 0" @click="gotoStep2">
            {{ $t('page.server.move.moveTo') }}
          </NButton>
        </template>
        <template v-else>
          <NButton @click="step = 1">{{ $t('page.server.move.back') }}</NButton>
          <NButton
            type="primary"
            :disabled="targetGroupId == null"
            :loading="submitting"
            @click="confirmMove"
          >
            {{ $t('page.server.move.confirm') }}
          </NButton>
        </template>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
