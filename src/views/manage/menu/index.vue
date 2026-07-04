<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import type { DataTableColumns, TreeInst, TreeOption } from 'naive-ui';
import { NButton, NDivider, NIcon, NPopconfirm } from 'naive-ui';
import { useBoolean, useLoading } from '@sa/hooks';
import { menuIsFrameRecord, menuTypeRecord } from '@/constants/business';
import {
  fetchDeleteMenu,
  fetchGetMenuList,
  fetchDeleteButton,
  fetchGetMenuButtons
} from '@/service/api/system';
import { fetchGetAppList } from '@/service/api/system/app';
import { useAppStore } from '@/store/modules/app';
import { useDict } from '@/hooks/business/dict';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import SvgIcon from '@/components/custom/svg-icon.vue';
import DictTag from '@/components/custom/dict-tag.vue';
import ButtonIcon from '@/components/custom/button-icon.vue';
import MenuOperateDrawer from './modules/menu-operate-drawer.vue';
import MenuCascadeDeleteModal from './modules/menu-cascade-delete-modal.vue';

useDict('sys_show_hide');
useDict('sys_normal_disable');

const defaultIcon = import.meta.env.VITE_MENU_ICON;

const { hasAuth } = useAuth();
const appStore = useAppStore();
const editingData = ref<Api.System.Menu>();
const operateType = ref<NaiveUI.TableOperateType>('add');
const { loading, startLoading, endLoading } = useLoading();
const { bool: drawerVisible, setTrue: openDrawer } = useBoolean();
const { bool: cascadeDeleteVisible, setTrue: openCascadeDeleteDrawer } = useBoolean();
const { loading: btnLoading, startLoading: startBtnLoading, endLoading: endBtnLoading } = useLoading();
/** tree pattern name , use tree search */
const name = ref<string>();
const createType = ref<Api.System.MenuType>();
const createPid = ref<CommonType.IdType>(0);
const currentMenu = ref<Api.System.Menu>();
const treeData = ref<Api.System.Menu[]>([]);
const checkedKeys = ref<CommonType.IdType[]>([0]);
const expandedKeys = ref<CommonType.IdType[]>([0]);

// 是否为目录类型
const isCatalog = computed(() => currentMenu.value?.menuType === 'M');

// 是否为菜单类型
const isMenu = computed(() => currentMenu.value?.menuType === 'C');

// 外链类型
const isExternalType = computed(() => currentMenu.value?.isFrame === '0');

// iframe类型
const isIframeType = computed(() => currentMenu.value?.isFrame === '2');

const menuTreeRef = ref<TreeInst>();
const btnData = ref<Api.System.ButtonList>([]);

// 模块相关状态
const appList = ref<Api.System.AppList>([]);
const activeModule = ref<string>('');

// 模块下拉选项（纯国际化：label 走 modules.<appCode> 翻译；缺翻译时回显 key 原文）
const moduleOptions = computed(() =>
  appList.value.map(app => ({ label: $t(`modules.${app.appCode}`), value: app.appCode }))
);

// 按钮编辑状态
const editingButtonData = ref<Api.System.Button | null>(null);
const buttonOperateType = ref<NaiveUI.TableOperateType>('add');
const operateDataType = ref<'menu' | 'button'>('menu');

const getMeunTree = async () => {
  startLoading();
  const module = activeModule.value || undefined;
  const { data, error } = await fetchGetMenuList(module ? { module } : undefined);
  if (error) return;
  // 后端返回的已经是树形结构，直接添加根节点
  treeData.value = [
    {
      menuId: 0,
      parentId: 0,
      menuName: $t('page.system.menu.rootName'),
      icon: 'material-symbols:home-outline-rounded',
      children: data
    }
  ] as Api.System.Menu[];
  endLoading();
};

// 监听模块切换
watch(activeModule, () => {
  currentMenu.value = undefined;
  checkedKeys.value = [];
  expandedKeys.value = [0];
  getMeunTree();
});

async function handleSubmitted(menuType?: Api.System.MenuType) {
  if (menuType === 'F') {
    await getBtnMenuList();
    return;
  }
  await getMeunTree();
  if (operateType.value === 'edit') {
    currentMenu.value = menuTreeRef.value?.getCheckedData().options[0] as Api.System.Menu;
  }
}

function handleAddMenu(pid: CommonType.IdType) {
  operateDataType.value = 'menu';
  createPid.value = pid;
  createType.value = pid === 0 ? 'M' : 'C';
  operateType.value = 'add';
  openDrawer();
}

function handleUpdateMenu() {
  operateDataType.value = 'menu';
  operateType.value = 'edit';
  editingData.value = currentMenu.value;
  openDrawer();
}

async function handleDeleteMenu(id?: CommonType.IdType) {
  const { error } = await fetchDeleteMenu(id || checkedKeys.value[0]);
  if (error) return;
  window.$message?.success($t('common.deleteSuccess'));
  if (id) {
    getBtnMenuList();
    return;
  }
  expandedKeys.value.filter(item => !checkedKeys.value.includes(item));
  currentMenu.value = undefined;
  checkedKeys.value = [];
  getMeunTree();
}

function renderLabel({ option }: { option: TreeOption }) {
  let label = String(option.menuName);
  if (label?.startsWith('route.') || label?.startsWith('menu.')) {
    label = $t(label as App.I18n.I18nKey);
  }
  // 禁用的菜单显示红色（'0' = 停用/禁用）
  if (option.status === '0') {
    return (
      <div class="flex items-center gap-4px text-error-200">
        {label}
        <SvgIcon icon="ri:prohibited-line" class="text-16px" />
      </div>
    );
  }
  // 隐藏的菜单显示灰色（'1' = 隐藏）
  if (option.visible === '1') {
    return (
      <div class="flex items-center gap-4px text-gray-400">
        {label}
        <SvgIcon icon="codex:hidden" class="text-21px" />
      </div>
    );
  }
  return <div>{label}</div>;
}

function renderPrefix({ option }: { option: TreeOption }) {
  const renderLocalIcon = String(option.icon).startsWith('local-icon-');
  const icon = renderLocalIcon ? undefined : String(option.icon);
  const localIcon = renderLocalIcon ? String(option.icon).replace('local-icon-', 'menu-') : undefined;
  return <SvgIcon icon={icon || defaultIcon} localIcon={localIcon} />;
}

function renderSuffix({ option }: { option: TreeOption }) {
  if (!['M'].includes(String(option.menuType)) || !hasAuth('system:menu:add')) {
    return null;
  }

  return (
    <div class="flex-center gap-8px">
      <ButtonIcon
        text
        class="h-18px"
        icon="ic-round-plus"
        tooltip-content={$t('page.system.menu.addChildMenu')}
        onClick={(event: Event) => {
          event.stopPropagation();
          handleAddMenu(option.menuId as CommonType.IdType);
        }}
      />
    </div>
  );
}

function reset() {
  name.value = undefined;
  getMeunTree();
}

function handleClickTree(option: Array<TreeOption | null>) {
  checkedKeys.value = option?.map(item => item?.menuId as CommonType.IdType);

  const menu = option[0] as Api.System.Menu;
  if (menu?.menuId === 0) {
    return;
  }
  currentMenu.value = menu;
  getBtnMenuList();
}

const tagMap: Record<'0' | '1' | '2', NaiveUI.ThemeColor> = {
  '0': 'success',
  '1': 'warning',
  '2': 'primary'
};

const _controller = new AbortController();

async function getBtnMenuList() {
  if (!currentMenu.value?.menuId) {
    return;
  }
  startBtnLoading();
  btnData.value = [];

  const { data, error } = await fetchGetMenuButtons(currentMenu.value.menuId);
  if (error) {
    endBtnLoading();
    return;
  }

  btnData.value = data || [];
  endBtnLoading();
}

// 获取应用模块列表
async function getAppList() {
  const { data, error } = await fetchGetAppList();
  if (error) return;
  appList.value = data;
  if (appList.value.length > 0) {
    activeModule.value = appList.value[0].appCode;
  }
}

// 初始化
getAppList();

function _addBtnMenu() {
  operateDataType.value = 'button';
  buttonOperateType.value = 'add';
  editingButtonData.value = null;
  createPid.value = currentMenu.value?.menuId || 0;
  openDrawer();
}

function _handleUpdateBtnMenu(row: Api.System.Button) {
  operateDataType.value = 'button';
  buttonOperateType.value = 'edit';
  editingButtonData.value = row;
  openDrawer();
}

async function handleDeleteButtonInline(id: CommonType.IdType) {
  const { error } = await fetchDeleteButton(id);
  if (error) return;
  window.$message?.success($t('common.deleteSuccess'));
  await getBtnMenuList();
}

const btnColumns: DataTableColumns<Api.System.Button> = [
  {
    key: 'index',
    width: 64,
    align: 'center',
    title() {
      return (
        <NButton circle type="primary" size="small" onClick={() => _addBtnMenu()}>
          {{
            icon: () => (
              <NIcon>
                <SvgIcon icon="ic-round-plus" />
              </NIcon>
            )
          }}
        </NButton>
      );
    },
    render: (_row, index) => index + 1
  },
  {
    title: $t('page.system.menu.buttonLabel'),
    key: 'label',
    minWidth: 120
  },
  {
    title: $t('page.system.menu.buttonCode'),
    key: 'code',
    align: 'center',
    minWidth: 120
  },
  {
    title: $t('page.system.menu.orderNum'),
    key: 'orderNum',
    align: 'center',
    minWidth: 80
  },
  {
    title: $t('page.system.menu.createTime'),
    key: 'createdAt',
    align: 'center',
    minWidth: 150
  },
  {
    title: $t('common.action'),
    key: 'actions',
    width: 120,
    align: 'center',
    render(row) {
      const divider = () => {
        if (!hasAuth('system:menu:edit') || !hasAuth('system:menu:remove')) {
          return null;
        }
        return <NDivider vertical />;
      };

      const editBtn = () => {
        if (!hasAuth('system:menu:edit')) {
          return null;
        }
        return (
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:drive-file-rename-outline-outline"
            tooltipContent={$t('common.edit')}
            onClick={() => _handleUpdateBtnMenu(row)}
          />
        );
      };

      const deleteBtn = () => {
        if (!hasAuth('system:menu:remove')) {
          return null;
        }
        return (
          <ButtonIcon
            text
            type="error"
            icon="material-symbols:delete-outline"
            tooltipContent={$t('common.delete')}
            popconfirmContent={$t('page.system.menu.confirmDeleteButton')}
            onPositiveClick={() => handleDeleteButtonInline(row.id!)}
          />
        );
      };

      return (
        <div class="flex-center gap-8px">
          {editBtn()}
          {divider()}
          {deleteBtn()}
        </div>
      );
    }
  }
];

function renderMenuName(menuName: string) {
  return menuName?.startsWith('route.') || menuName?.startsWith('menu.') ? $t(menuName as App.I18n.I18nKey) : menuName;
}

/**
 * 渲染组件路径
 * 将后端存储的格式转换为实际文件路径格式
 * view.manage_user → manage/user/index
 * layout.base$view.manage_user → manage/user/index
 */
function renderComponentPath(component: string) {
  if (!component) return '';

  // 如果包含 $view.，取 $view. 后面的部分
  if (component.includes('$view.')) {
    component = component.split('$view.')[1];
  }

  // 如果以 view. 开头，去掉前缀
  if (component.startsWith('view.')) {
    component = component.slice(5);
  }

  // 将 _ 替换为 /，添加 /index 后缀
  return `${component.replaceAll('_', '/')}/index.vue`;
}

const renderIframeQuery = (queryParam: string) => {
  try {
    return JSON.parse(queryParam || '{}')?.url;
  } catch {
    return queryParam;
  }
};
</script>

<template>
  <TableSiderLayout default-expanded>
    <template #header>{{ $t('page.system.menu.title') }}</template>
    <template #header-extra>
      <ButtonIcon
        v-if="hasAuth('system:menu:add')"
        size="small"
        icon="material-symbols:add-rounded"
        class="h-28px text-icon color-primary"
        :tooltip-content="$t('page.system.menu.addMenu')"
        @click.stop="handleAddMenu(0)"
      />
      <ButtonIcon
        v-if="hasAuth('system:menu:add')"
        size="small"
        icon="material-symbols:delete-outline"
        class="h-28px text-icon color-error"
        :tooltip-content="$t('page.system.menu.cascadeDelete')"
        @click.stop="openCascadeDeleteDrawer"
      />
      <ButtonIcon
        size="small"
        icon="material-symbols:refresh-rounded"
        class="h-28px text-icon"
        :tooltip-content="$t('common.refresh')"
        @click.stop="reset"
      />
    </template>
    <template #sider>
      <!-- 模块下拉选择 -->
      <NSelect
        v-if="appList.length > 0"
        v-model:value="activeModule"
        :options="moduleOptions"
        :placeholder="$t('page.system.menu.selectModule')"
        :consistent-menu-width="false"
        size="small"
        class="mb-8px"
      />
      <div class="flex gap-6px">
        <NInput v-model:value="name" size="small" :placeholder="$t('page.system.menu.form.menuName.required')" />
      </div>
      <NSpin :show="loading" class="infinite-scroll">
        <NTree
          ref="menuTreeRef"
          v-model:checked-keys="checkedKeys"
          v-model:expanded-keys="expandedKeys"
          :cancelable="false"
          :cascade="false"
          block-node
          show-line
          :data="treeData as []"
          :default-expanded-keys="[0]"
          :show-irrelevant-nodes="false"
          :pattern="name"
          class="menu-tree py-3"
          key-field="menuId"
          label-field="menuName"
          virtual-scroll
          checkable
          :render-label="renderLabel"
          :render-prefix="renderPrefix"
          :render-suffix="renderSuffix"
          @update:selected-keys="(_: Array<string & number>, option: Array<TreeOption | null>) => handleClickTree(option)"
        >
          <template #empty>
            <NEmpty :description="$t('page.system.menu.emptyMenu')" class="h-full min-h-200px justify-center" />
          </template>
        </NTree>
      </NSpin>
    </template>
    <div class="h-full flex-col-stretch gap-16px">
      <template v-if="currentMenu">
        <NCard
          :title="$t('page.system.menu.menuDetail')"
          :bordered="false"
          size="small"
          class="max-h-50% card-wrapper"
          content-class="overflow-auto mb-12px"
        >
          <template #header-extra>
            <NSpace>
              <NButton
                v-if="isCatalog && hasAuth('system:menu:add')"
                size="small"
                ghost
                type="primary"
                @click="handleAddMenu(currentMenu.menuId!)"
              >
                <template #icon>
                  <icon-material-symbols-add-rounded />
                </template>
                {{ $t('page.system.menu.addChildMenu') }}
              </NButton>
              <NButton v-if="hasAuth('system:menu:edit')" size="small" ghost type="primary" @click="handleUpdateMenu">
                <template #icon>
                  <icon-material-symbols-drive-file-rename-outline-outline />
                </template>
                {{ $t('common.edit') }}
              </NButton>
              <NPopconfirm @positive-click="() => handleDeleteMenu()">
                <template #trigger>
                  <NButton
                    v-if="hasAuth('system:menu:remove')"
                    size="small"
                    ghost
                    type="error"
                    :disabled="btnData.length > 0 || btnLoading"
                  >
                    <template #icon>
                      <icon-material-symbols-delete-outline />
                    </template>
                    {{ $t('common.delete') }}
                  </NButton>
                </template>
                {{ $t('common.confirmDelete') }}
              </NPopconfirm>
            </NSpace>
          </template>
          <NDescriptions
            label-placement="left"
            size="small"
            bordered
            :column="appStore.isMobile ? 1 : 2"
            label-class="w-20% min-w-88px"
            content-class="w-100px"
          >
            <NDescriptionsItem :label="$t('page.system.menu.menuType')">
              <NTag class="m-1" size="small" type="primary">{{ menuTypeRecord[currentMenu.menuType!] }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.system.menu.status')">
              <DictTag size="small" :value="currentMenu.status" dict-code="sys_normal_disable" />
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.system.menu.menuName')">
              {{ renderMenuName(currentMenu.menuName) }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="isMenu" :label="$t('page.system.menu.component')">
              {{ renderComponentPath(currentMenu.component) }}
            </NDescriptionsItem>
            <NDescriptionsItem
              :label="!isExternalType ? $t('page.system.menu.path') : $t('page.system.menu.externalPath')"
            >
              {{ currentMenu.path?.startsWith('/') ? currentMenu.path.slice(1) : currentMenu.path }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="isMenu && !isExternalType && !isIframeType" :label="$t('page.system.menu.query')">
              {{ currentMenu.queryParam }}
            </NDescriptionsItem>
            <NDescriptionsItem
              v-if="isMenu && !isExternalType && isIframeType"
              :label="$t('page.system.menu.iframeQuery')"
            >
              {{ renderIframeQuery(currentMenu.queryParam) }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="!isCatalog" :label="$t('page.system.menu.perms')">
              {{ currentMenu.perms }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.system.menu.isFrame')">
              <NTag v-if="currentMenu.isFrame" class="m-1" size="small" :type="tagMap[currentMenu.isFrame]">
                {{ menuIsFrameRecord[currentMenu.isFrame] }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem :label="$t('page.system.menu.visible')">
              <DictTag size="small" :value="currentMenu.visible" dict-code="sys_show_hide" />
            </NDescriptionsItem>
            <NDescriptionsItem v-if="isMenu" :label="$t('page.system.menu.isCache')">
              <NTag v-if="currentMenu.isCache" class="m-1" size="small" :type="tagMap[currentMenu.isCache]">
                {{ currentMenu.isCache === '0' ? $t('page.system.menu.cache') : $t('page.system.menu.noCache') }}
              </NTag>
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <NCard
          :title="$t('page.system.menu.buttonPermissionList')"
          :bordered="false"
          size="small"
          class="h-full overflow-auto card-wrapper"
          content-class="overflow-auto mb-12px"
        >
          <template #header-extra>
            <ButtonIcon
              size="small"
              icon="ic-round-refresh"
              class="h-28px text-icon"
              :tooltip-content="$t('common.refresh')"
              @click.stop="getBtnMenuList"
            />
          </template>
          <NDataTable class="h-full" :loading="btnLoading" :columns="btnColumns" :data="btnData" />
        </NCard>
      </template>
      <NCard v-else :bordered="false" size="small" class="h-full card-wrapper">
        <NEmpty class="h-full flex-center" size="large" />
      </NCard>
    </div>
    <MenuOperateDrawer
      v-model:visible="drawerVisible"
      :operate-type="operateDataType === 'button' ? buttonOperateType : operateType"
      :operate-data-type="operateDataType"
      :row-data="operateDataType === 'menu' ? editingData : null"
      :button-data="operateDataType === 'button' ? editingButtonData : null"
      :tree-data="treeData"
      :pid="createPid"
      :menu-type="operateDataType === 'menu' ? createType : undefined"
      @submitted="handleSubmitted"
    />
    <MenuCascadeDeleteModal v-model:visible="cascadeDeleteVisible" @submitted="handleSubmitted" />
  </TableSiderLayout>
</template>

<style scoped lang="scss">
:deep(.infinite-scroll) {
  height: auto;
  max-height: calc(100vh - 224px - var(--calc-footer-height, 0px));
  overflow-y: auto;
}

@media screen and (max-width: 1024px) {
  :deep(.infinite-scroll) {
    max-height: calc(100vh - 227px - var(--calc-footer-height, 0px));
  }
}

:deep(.n-spin-content) {
  height: 100%;
}

:deep(.n-tree-node-checkbox) {
  display: none;
}

:deep(.n-data-table-base-table) {
  height: 100% !important;
}

.menu-tree {
  :deep(.n-tree-node) {
    height: 25px;
  }

  :deep(.n-tree-node-switcher) {
    height: 25px;
  }

  :deep(.n-tree-node-switcher__icon) {
    font-size: 16px !important;
    height: 16px !important;
    width: 16px !important;
  }
}
</style>
