<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue';
import { $t } from '@/locales';
import { fetchGetUserSelect } from '@/service/api/system/user';

defineOptions({
  name: 'ShareUserSearch'
});

interface UserOption {
  label: string;
  value: number;
  avatar?: string;
}

interface Emits {
  (e: 'select', users: UserOption[]): void;
}

const emit = defineEmits<Emits>();

const searchKeyword = ref('');
const userOptions = ref<UserOption[]>([]);
const loading = ref(false);
const selectedUserIds = ref<Set<number>>(new Set());

const selectedUsers = computed(() => {
  return userOptions.value.filter(u => selectedUserIds.value.has(u.value));
});

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

async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    userOptions.value = [];
    return;
  }

  loading.value = true;
  const { data } = await fetchGetUserSelect();
  if (data) {
    const keyword = searchKeyword.value.toLowerCase();
    userOptions.value = data
      .filter(u => {
        const name = u.nickName ? `${u.nickName}（${u.userName}）` : u.userName;
        return name.toLowerCase().includes(keyword) || u.userName.toLowerCase().includes(keyword);
      })
      .map(u => ({
        label: u.nickName ? `${u.nickName}（${u.userName}）` : u.userName,
        value: u.userId as number,
        avatar: u.avatar
      }));
  }
  loading.value = false;
}

function toggleUserSelection(userId: number, checked: boolean) {
  if (checked) {
    selectedUserIds.value.add(userId);
  } else {
    selectedUserIds.value.delete(userId);
  }
}

function removeUser(userId: number) {
  selectedUserIds.value.delete(userId);
}

function handleConfirm() {
  const users = userOptions.value.filter(u => selectedUserIds.value.has(u.value));
  emit('select', users);
  selectedUserIds.value.clear();
  searchKeyword.value = '';
  userOptions.value = [];
}

onMounted(() => {
  handleSearch();
});
</script>

<template>
  <div class="flex flex-col gap-12px">
    <div class="flex gap-8px">
      <NInput
        v-model:value="searchKeyword"
        :placeholder="$t('page.disk.share.searchUser')"
        clearable
        @update:value="handleSearch"
      />
      <NButton :loading="loading" @click="handleSearch">
        {{ $t('common.search') }}
      </NButton>
    </div>

    <div v-if="userOptions.length > 0" class="flex flex-col gap-8px">
      <div class="text-13px opacity-70">{{ $t('page.disk.share.searchUser') }}</div>
      <NSpace vertical :size="8">
        <NCheckbox
          v-for="user in userOptions"
          :key="user.value"
          :checked="selectedUserIds.has(user.value)"
          @update:checked="(checked: boolean) => toggleUserSelection(user.value, checked)"
        >
          <component :is="renderUserLabel(user)" />
        </NCheckbox>
      </NSpace>
    </div>

    <div v-if="selectedUsers.length > 0" class="flex flex-col gap-8px">
      <div class="text-13px opacity-70">{{ $t('page.disk.share.sharedUsers') }}</div>
      <NSpace :size="8">
        <NTag
          v-for="user in selectedUsers"
          :key="user.value"
          :closable="true"
          @close="removeUser(user.value)"
        >
          <template #avatar>
            <NAvatar
              v-if="user.avatar"
              :src="user.avatar"
              :size="18"
              :round="true"
              :img-props="{ style: 'object-fit:cover' }"
            />
            <NAvatar
              v-else
              :size="18"
              :round="true"
              :style="{ backgroundColor: '#18a058' }"
            >
              {{ user.label.charAt(0) }}
            </NAvatar>
          </template>
          {{ user.label }}
        </NTag>
      </NSpace>
    </div>

    <div v-if="selectedUsers.length > 0" class="flex justify-end">
      <NButton type="primary" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </NButton>
    </div>
  </div>
</template>
