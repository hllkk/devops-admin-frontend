<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { NDropdown, NInput, NSpin, NTree } from 'naive-ui';
import type { DropdownOption, TreeOption } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchGetGroupTree, fetchDeleteGroup } from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerGroupTree' });

interface Emits {
  (e: 'refreshServer'): void;
  (e: 'create', parentId: CommonType.IdType): void;
  (e: 'rename', group: Api.Server.ServerGroup): void;
  (e: 'addServer', groupId: CommonType.IdType): void;
  (e: 'moveServers', targetGroupId: CommonType.IdType): void;
  (e: 'batchDelete'): void;
  (e: 'delete', group: Api.Server.ServerGroup): void;
}

const emit = defineEmits<Emits>();

const selectedKey = defineModel<CommonType.IdType>({ required: true });

const { bool: loading, setTrue: startLoading, setFalse: endLoading } = useBoolean();
const treeData = ref<Api.Server.ServerGroup[]>([]);
const expandedKeys = ref<CommonType.IdType[]>([1, 2]);
const pattern = ref('');

const checkedServerCount = defineModel<number>('checkedServerCount', { default: 0 });

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: Api.Server.ServerGroup | null;
}

const contextMenu = ref<ContextMenuState>({ visible: false, x: 0, y: 0, node: null });

async function getGroupTree() {
  startLoading();
  const { data, error } = await fetchGetGroupTree();
  endLoading();
  if (!error && data) {
    // 在顶部插入"全部主机"虚拟根节点(id=0,parentId=-1),让用户能右击它
    const totalCount = (data ?? []).reduce((sum, n) => sum + (n.serverCount ?? 0), 0);
    const allRoot: Api.Server.ServerGroup = {
      id: 0,
      parentId: -1,
      name: $t('page.server.group.all'),
      orderNum: 0,
      serverCount: totalCount
    };
    treeData.value = [allRoot, ...(data ?? [])];
  }
}

onMounted(() => {
  getGroupTree();
});

watch(
  () => selectedKey.value,
  () => {
    // 父级更新分组时,刷新树以更新 serverCount
    getGroupTree();
  }
);

function handleUpdateSelectedKeys(keys: CommonType.IdType[]) {
  const key = keys[0] ?? 0;
  selectedKey.value = key;
  closeContextMenu();
}

function renderLabel({ option }: { option: TreeOption }) {
  const node = option as unknown as Api.Server.ServerGroup;
  return h('div', { class: 'flex items-center justify-between gap-8px' }, [
    h('span', { class: 'truncate' }, node.name),
    h('span', { class: 'text-11px opacity-60' }, `(${node.serverCount ?? 0})`)
  ]);
}

const contextMenuOptions = computed<DropdownOption[]>(() => {
  const node = contextMenu.value.node;
  if (!node) return [];
  const isRoot = node.id === 0;
  const hasChecked = checkedServerCount.value > 0;
  const opts: DropdownOption[] = [{ key: 'create', label: $t('page.server.group.create') }];
  if (!isRoot) {
    opts.push(
      { key: 'rename', label: $t('page.server.group.rename') },
      { key: 'addServer', label: $t('page.server.group.addServer') }
    );
    if (hasChecked) {
      opts.push(
        { key: 'moveServers', label: $t('page.server.group.moveServers') },
        { key: 'batchDelete', label: $t('page.server.group.batchDelete') }
      );
    }
    opts.push({ type: 'divider', key: 'd1' }, { key: 'delete', label: $t('page.server.group.delete') });
  }
  return opts;
});

function handleRightClick({ node, event }: { node: TreeOption; event: MouseEvent }) {
  event.preventDefault();
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node: node as unknown as Api.Server.ServerGroup
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

async function handleContextMenuSelect(key: string) {
  const node = contextMenu.value.node;
  if (!node) return;
  closeContextMenu();
  switch (key) {
    case 'create':
      emit('create', node.id);
      break;
    case 'rename':
      emit('rename', node);
      break;
    case 'addServer':
      emit('addServer', node.id);
      break;
    case 'moveServers':
      emit('moveServers', node.id);
      break;
    case 'batchDelete':
      emit('batchDelete');
      break;
    case 'delete':
      // 直接二次确认(实际可改为独立 modal,但简单起见)
      const confirmed = window.confirm($t('page.server.group.confirmDelete', { name: node.name }));
      if (!confirmed) return;
      const { error } = await fetchDeleteGroup(node.id);
      if (error) {
        window.$message?.error(error.message);
        return;
      }
      window.$message?.success($t('page.server.group.deleteSuccess'));
      if (selectedKey.value === node.id) selectedKey.value = 0;
      emit('refreshServer');
      break;
  }
}

defineExpose({ refresh: getGroupTree });
</script>

<template>
  <div class="flex flex-col gap-8px">
    <NInput v-model:value="pattern" :placeholder="$t('common.keywordSearch')" clearable />
    <NSpin :show="loading" class="dept-tree min-h-200px">
      <NTree
        :data="treeData as unknown as TreeOption[]"
        :pattern="pattern"
        block-node
        show-line
        virtual-scroll
        key-field="id"
        label-field="name"
        :selected-keys="[selectedKey]"
        :expanded-keys="expandedKeys"
        :render-label="renderLabel"
        @update:selected-keys="handleUpdateSelectedKeys"
        @update:expanded-keys="(keys: number[]) => (expandedKeys = keys)"
        @right-click="handleRightClick"
      >
        <template #empty>
          <div class="py-12px text-center text-12px opacity-50">{{ $t('common.noData') }}</div>
        </template>
      </NTree>
    </NSpin>
    <div class="flex items-center gap-4px text-11px opacity-60">
      <icon-mdi-dots-horizontal class="text-12px" />
      <span>{{ $t('page.server.group.rightClickHint') }}</span>
    </div>
    <NButton size="tiny" block ghost @click="emit('create', 0)">
      <template #icon>
        <icon-ic-round-add class="text-icon" />
      </template>
      {{ $t('page.server.group.createRoot') }}
    </NButton>
    <NDropdown
      :show="contextMenu.visible"
      :options="contextMenuOptions"
      :x="contextMenu.x"
      :y="contextMenu.y"
      placement="bottom-start"
      trigger="manual"
      @clickoutside="closeContextMenu"
      @select="handleContextMenuSelect"
    />
  </div>
</template>

<style scoped>
.dept-tree {
  :deep(.n-tree-node) {
    height: 30px;
  }
  :deep(.n-tree-node-switcher) {
    height: 30px;
  }
}
</style>