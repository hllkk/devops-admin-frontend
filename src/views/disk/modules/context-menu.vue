<script setup lang="ts">
import { computed } from 'vue';
import type { DropdownOption } from 'naive-ui';
import { useSvgIcon } from '@/hooks/common/icon';
import { $t } from '@/locales';

defineOptions({
  name: 'DiskContextMenu'
});

interface Props {
  x: number;
  y: number;
  type: 'file' | 'area';
  /** 页面类型，用于区分收藏/取消收藏菜单 */
  pageType?: 'disk' | 'favorite' | 'recent' | 'my-share' | 'trash';
  /** 当前文件是否已收藏（右键单个文件时使用） */
  fileIsFavorite?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pageType: 'disk',
  fileIsFavorite: false
});

const visible = defineModel<boolean>('visible');

const emit = defineEmits<{
  (e: 'select', key: string): void;
}>();

const { SvgIconVNode } = useSvgIcon();

const isFavoritePage = computed(() => props.pageType === 'favorite');
const isTrashPage = computed(() => props.pageType === 'trash');

const trashFileOptions = computed<DropdownOption[]>(() => [
  {
    label: $t('page.disk.trash.restore'),
    key: 'restore',
    icon: SvgIconVNode({ icon: 'mdi:restore', fontSize: 18 })
  },
  {
    label: $t('page.disk.trash.deletePermanently'),
    key: 'delete',
    icon: SvgIconVNode({ icon: 'mdi:delete-forever', fontSize: 18 })
  }
]);

const fileOptions = computed<DropdownOption[]>(() => {
  if (isTrashPage.value) {
    return trashFileOptions.value;
  }

  const showRemoveFavorite = isFavoritePage.value || props.fileIsFavorite === true;

  return [
    {
      label: $t('page.disk.contextMenu.open'),
      key: 'open',
      icon: SvgIconVNode({ icon: 'mdi:open-in-new', fontSize: 18 })
    },
    {
      label: showRemoveFavorite ? $t('page.disk.contextMenu.removeFavorite') : $t('page.disk.contextMenu.addFavorite'),
      key: showRemoveFavorite ? 'removeFavorite' : 'addFavorite',
      icon: SvgIconVNode({ icon: showRemoveFavorite ? 'mdi:star-off-outline' : 'mdi:star-outline', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.download'),
      key: 'download',
      icon: SvgIconVNode({ icon: 'mdi:download-outline', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.share'),
      key: 'share',
      icon: SvgIconVNode({ icon: 'mdi:share-outline', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.copy'),
      key: 'copy',
      icon: SvgIconVNode({ icon: 'mdi:content-copy', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.move'),
      key: 'move',
      icon: SvgIconVNode({ icon: 'mdi:folder-move-outline', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.rename'),
      key: 'rename',
      icon: SvgIconVNode({ icon: 'mdi:pencil-outline', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.delete'),
      key: 'delete',
      icon: SvgIconVNode({ icon: 'mdi:delete-outline', fontSize: 18 })
    },
    {
      type: 'divider',
      key: 'd-detail'
    },
    {
      label: $t('page.disk.contextMenu.detail'),
      key: 'detail',
      icon: SvgIconVNode({ icon: 'mdi:information-outline', fontSize: 18 })
    }
  ];
});

const areaOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = [
    {
      label: $t('page.disk.contextMenu.view'),
      key: 'view',
      icon: SvgIconVNode({ icon: 'mdi:eye-outline', fontSize: 18 }),
      children: [
        {
          label: $t('page.disk.contextMenu.viewGrid'),
          key: 'view-grid',
          icon: SvgIconVNode({ icon: 'mdi:view-grid-outline', fontSize: 18 })
        },
        {
          label: $t('page.disk.contextMenu.viewList'),
          key: 'view-list',
          icon: SvgIconVNode({ icon: 'mdi:view-list-outline', fontSize: 18 })
        }
      ]
    },
    {
      label: $t('page.disk.contextMenu.sortBy'),
      key: 'sort',
      icon: SvgIconVNode({ icon: 'mdi:sort', fontSize: 18 }),
      children: [
        {
          label: $t('page.disk.contextMenu.sortName'),
          key: 'sort-name',
          icon: SvgIconVNode({ icon: 'mdi:sort-alphabetical-ascending', fontSize: 18 })
        },
        {
          label: $t('page.disk.contextMenu.sortSize'),
          key: 'sort-size',
          icon: SvgIconVNode({ icon: 'mdi:sort-numeric-ascending', fontSize: 18 })
        },
        {
          label: $t('page.disk.contextMenu.sortTime'),
          key: 'sort-modifyTime',
          icon: SvgIconVNode({ icon: 'mdi:clock-outline', fontSize: 18 })
        }
      ]
    },
    {
      label: $t('page.disk.contextMenu.refresh'),
      key: 'refresh',
      icon: SvgIconVNode({ icon: 'mdi:refresh', fontSize: 18 })
    },
    {
      label: $t('page.disk.contextMenu.reload'),
      key: 'reload',
      icon: SvgIconVNode({ icon: 'mdi:reload', fontSize: 18 })
    }
  ];

  if (isTrashPage.value) {
    options.unshift({
      label: $t('page.disk.trash.empty'),
      key: 'emptyTrash',
      icon: SvgIconVNode({ icon: 'mdi:delete-sweep', fontSize: 18 })
    });
  }

  return options;
});

const options = computed(() => (props.type === 'file' ? fileOptions.value : areaOptions.value));

function hide() {
  visible.value = false;
}

function handleSelect(key: string) {
  emit('select', key);
  hide();
}
</script>

<template>
  <NDropdown
    :show="visible"
    placement="bottom-start"
    trigger="manual"
    :x="x"
    :y="y"
    :options="options"
    :menu-props="() => ({ class: 'disk-ctx-glass' })"
    @clickoutside="hide"
    @select="handleSelect"
  />
</template>

<style>
/* 右键菜单毛玻璃效果 */
.n-dropdown-menu.disk-ctx-glass {
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
}

html.dark .n-dropdown-menu.disk-ctx-glass {
  background: rgba(30, 30, 30, 0.6) !important;
  border-color: rgba(255, 255, 255, 0.08);
}
</style>
