<script setup lang="ts">
import { computed, h, onMounted, ref, watch, type VNode } from 'vue';
import { NButton, NDropdown, NInput, NSpin, NTree } from 'naive-ui';
import type { DropdownOption, TreeOption } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { useSvgIcon } from '@/hooks/common/icon';
import {
  fetchCreateGroup,
  fetchRenameGroup,
  fetchGetGroupTree,
  fetchDeleteGroup
} from '@/service/api/server/server';
import { $t } from '@/locales';

defineOptions({ name: 'ServerGroupTree' });

interface Emits {
  (e: 'refreshServer'): void;
  (e: 'addServer', groupId: CommonType.IdType): void;
  (e: 'moveHosts', groupId: CommonType.IdType): void;
  (e: 'deleteHosts', group: Api.Server.ServerGroup): void;
}

const emit = defineEmits<Emits>();

const { SvgIconVNode } = useSvgIcon();

const selectedKey = defineModel<CommonType.IdType>({ required: true });

const { bool: loading, setTrue: startLoading, setFalse: endLoading } = useBoolean();
const treeData = ref<Api.Server.ServerGroup[]>([]);
const expandedKeys = ref<CommonType.IdType[]>([1, 2]);
const pattern = ref('');

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: Api.Server.ServerGroup | null;
}

const contextMenu = ref<ContextMenuState>({ visible: false, x: 0, y: 0, node: null });

// ============ 内联编辑（新建根分组 / 新建子分组 / 重命名） ============
const TEMP_ID = 'new' as unknown as CommonType.IdType;

interface EditState {
  mode: 'create' | 'rename';
  nodeId: CommonType.IdType;
  parentId: CommonType.IdType;
  value: string;
}
const editing = ref<EditState | null>(null);

function addChildToTree(
  nodes: Api.Server.ServerGroup[],
  parentId: CommonType.IdType,
  child: Api.Server.ServerGroup
): Api.Server.ServerGroup[] {
  return nodes.map(n => {
    if (n.id === parentId) {
      return { ...n, children: [...(n.children ?? []), child] };
    }
    if (n.children) return { ...n, children: addChildToTree(n.children, parentId, child) };
    return n;
  });
}

function removeTempNode(nodes: Api.Server.ServerGroup[]): Api.Server.ServerGroup[] {
  return nodes
    .filter(n => n.id !== TEMP_ID)
    .map(n => (n.children ? { ...n, children: removeTempNode(n.children) } : n));
}

function startCreateRoot() {
  treeData.value = [{ id: TEMP_ID, parentId: 0, name: '' }, ...treeData.value];
  editing.value = { mode: 'create', nodeId: TEMP_ID, parentId: 0, value: '' };
}

function startCreateChild(node: Api.Server.ServerGroup) {
  treeData.value = addChildToTree(treeData.value, node.id, {
    id: TEMP_ID,
    parentId: node.id,
    name: ''
  });
  if (!expandedKeys.value.includes(node.id)) {
    expandedKeys.value = [...expandedKeys.value, node.id];
  }
  editing.value = { mode: 'create', nodeId: TEMP_ID, parentId: node.id, value: '' };
}

function startRename(node: Api.Server.ServerGroup) {
  editing.value = { mode: 'rename', nodeId: node.id, parentId: node.parentId, value: node.name };
}

async function confirmEdit() {
  const ed = editing.value;
  if (!ed) return;
  const name = ed.value.trim();
  if (!name) {
    window.$message?.warning($t('page.server.group.nameRequired'));
    return;
  }
  if (ed.mode === 'create') {
    const { error } = await fetchCreateGroup({ parentId: ed.parentId, name });
    if (error) {
      window.$message?.error(error.message);
      return;
    }
    window.$message?.success($t('page.server.group.createSuccess'));
  } else {
    const { error } = await fetchRenameGroup({ id: ed.nodeId, name });
    if (error) {
      window.$message?.error(error.message);
      return;
    }
    window.$message?.success($t('page.server.group.renameSuccess'));
  }
  editing.value = null;
  await getGroupTree();
  emit('refreshServer');
}

function cancelEdit() {
  if (!editing.value) return;
  const wasCreate = editing.value.mode === 'create';
  editing.value = null;
  if (wasCreate) {
    treeData.value = removeTempNode(treeData.value);
  }
}

// ============ 数据加载 ============

async function getGroupTree() {
  startLoading();
  const { data, error } = await fetchGetGroupTree();
  endLoading();
  if (!error && data) {
    treeData.value = data;
  }
}

onMounted(() => {
  getGroupTree();
});

watch(
  () => selectedKey.value,
  () => {
    if (editing.value) return; // 编辑态不刷新树,避免打断输入
    // 父级更新分组时,刷新树以更新 serverCount
    getGroupTree();
  }
);

function handleUpdateSelectedKeys(keys: CommonType.IdType[]) {
  if (editing.value) return; // 编辑态不切换选中,避免刷新打断输入
  const key = keys[0] ?? 0;
  selectedKey.value = key;
  closeContextMenu();
}

function renderLabel({ option }: { option: TreeOption }) {
  const node = option as unknown as Api.Server.ServerGroup;

  // 编辑态：原位输入框 + 确认按钮
  if (editing.value && node.id === editing.value.nodeId) {
    return h('div', { class: 'flex items-center gap-4px flex-1 min-w-0' }, [
      h(NInput, {
        value: editing.value.value,
        size: 'small',
        placeholder: $t('page.server.group.nameRequired'),
        onUpdateValue: (v: string) => {
          if (editing.value) editing.value.value = v;
        },
        onKeydown: (e: KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        },
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onMousedown: (e: MouseEvent) => e.stopPropagation(),
        onBlur: () => cancelEdit(),
        onVnodeMounted: (vnode: VNode) => {
          const el = vnode.el as HTMLElement | null;
          el?.querySelector('input')?.focus();
        }
      }),
      h(
        NButton,
        {
          size: 'tiny',
          quaternary: true,
          type: 'primary',
          onMousedown: (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            confirmEdit();
          }
        },
        () => [SvgIconVNode({ icon: 'ph:check', fontSize: 16 })?.()]
      )
    ]);
  }

  return h('div', { class: 'flex items-center justify-between gap-8px' }, [
    h('span', { class: 'truncate' }, node.name),
    h('span', { class: 'text-11px opacity-60' }, `(${node.serverCount ?? 0})`)
  ]);
}

// ============ 右键菜单 ============

type MenuOption = DropdownOption & { iconName?: string; danger?: boolean };

function renderDropdownLabel(option: MenuOption) {
  const iconVNode = option.iconName ? SvgIconVNode({ icon: option.iconName, fontSize: 18 })?.() : null;
  return h(
    'div',
    { class: `flex items-center gap-6px ${option.danger ? 'text-red-500 dark:text-red-400' : ''}` },
    [iconVNode, h('span', null, option.label as string)].filter(Boolean)
  );
}

const contextMenuOptions = computed<MenuOption[]>(() => {
  const node = contextMenu.value.node;
  if (!node) return [];
  const isRoot = node.id === 0;
  const noDirectHosts = (node.serverCount ?? 0) === 0;
  const busy = editing.value !== null; // 编辑态时禁止再新建/重命名
  const opts: MenuOption[] = [];

  if (isRoot) {
    opts.push(
      { key: 'createRoot', label: $t('page.server.group.createRoot'), iconName: 'ph:folder-plus', disabled: busy },
      { key: 'moveHosts', label: $t('page.server.group.moveHosts'), iconName: 'ph:arrows-left-right' }
    );
    return opts;
  }

  opts.push(
    { key: 'createRoot', label: $t('page.server.group.createRoot'), iconName: 'ph:folder-plus', disabled: busy },
    { key: 'createChild', label: $t('page.server.group.create'), iconName: 'ph:folder-notch-plus', disabled: busy },
    { key: 'rename', label: $t('page.server.group.rename'), iconName: 'ph:pencil-simple-line', disabled: busy },
    { key: 'addServer', label: $t('page.server.group.addServer'), iconName: 'ph:desktop-tower' },
    { key: 'moveHosts', label: $t('page.server.group.moveHosts'), iconName: 'ph:arrows-left-right' },
    {
      key: 'deleteHosts',
      label: $t('page.server.group.deleteHosts'),
      iconName: 'ph:trash',
      danger: true,
      disabled: noDirectHosts
    },
    { type: 'divider', key: 'd1' },
    { key: 'delete', label: $t('page.server.group.delete'), iconName: 'ph:folder-minus', danger: true }
  );
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

/**
 * NTree 不提供 right-click 事件, 需通过 node-props 为每个节点注入原生 contextmenu 处理
 * 参考: https://www.naiveui.com/zh-CN/os-theme/components/tree#node-props-Prop
 */
function nodeProps({ option }: { option: TreeOption }) {
  return {
    onContextmenu(e: MouseEvent) {
      e.preventDefault();
      handleRightClick({ node: option, event: e });
    }
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function handleContextMenuSelect(key: string) {
  const node = contextMenu.value.node;
  if (!node) return;
  closeContextMenu();
  switch (key) {
    case 'createRoot':
      startCreateRoot();
      break;
    case 'createChild':
      startCreateChild(node);
      break;
    case 'rename':
      startRename(node);
      break;
    case 'addServer':
      emit('addServer', node.id);
      break;
    case 'moveHosts':
      emit('moveHosts', node.id);
      break;
    case 'deleteHosts':
      emit('deleteHosts', node);
      break;
    case 'delete':
      window.$dialog?.warning({
        title: $t('common.tip'),
        content: $t('page.server.group.confirmDelete', { name: node.name }),
        positiveText: $t('common.confirm'),
        negativeText: $t('common.cancel'),
        onPositiveClick: async () => {
          const { error } = await fetchDeleteGroup(node.id);
          if (error) {
            window.$message?.error(error.message);
            return;
          }
          window.$message?.success($t('page.server.group.deleteSuccess'));
          if (selectedKey.value === node.id) selectedKey.value = 0;
          emit('refreshServer');
        }
      });
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
        :node-props="nodeProps"
        @update:selected-keys="handleUpdateSelectedKeys"
        @update:expanded-keys="(keys: number[]) => (expandedKeys = keys)"
      >
        <template #empty>
          <div class="py-12px text-center text-12px opacity-50">{{ $t('common.noData') }}</div>
        </template>
      </NTree>
    </NSpin>
    <NDropdown
      :show="contextMenu.visible"
      :options="contextMenuOptions"
      :x="contextMenu.x"
      :y="contextMenu.y"
      placement="bottom-start"
      trigger="manual"
      :render-label="renderDropdownLabel"
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
