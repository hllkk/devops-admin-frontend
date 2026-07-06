<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NCard, NEmpty, NInput, NModal, NPopconfirm, NSpace, NTag } from 'naive-ui';
import { fetchAddProjectMember, fetchCreateProject, fetchDeleteProject, fetchGetProjectById, fetchGetProjectMembers, fetchGetProjectPage, fetchRemoveProjectMember, fetchUpdateProject } from '@/service/api/gateway';
import { fetchGetUserList } from '@/service/api/system/user';

defineOptions({
  name: 'GatewayProjectManage'
});

interface ProjectItem {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  memberCount: number;
  createTime: string;
}

interface MemberItem {
  id: number;
  username: string;
  displayName: string;
  position: string;
  joinedAt: string;
}

interface UserOption {
  id: number;
  username: string;
  displayName: string;
}

const projects = ref<ProjectItem[]>([]);
const selectedProject = ref<ProjectItem | null>(null);
const members = ref<MemberItem[]>([]);
const projectLoading = ref(false);
const memberLoading = ref(false);

// 项目表单
const showFormModal = ref(false);
const isEditing = ref(false);
const formName = ref('');
const formDescription = ref('');
const formError = ref('');
const formSubmitting = ref(false);

// 添加成员
const showAddMember = ref(false);
const searchKeyword = ref('');
const userCandidates = ref<UserOption[]>([]);
const selectedUserIds = ref<Set<number>>(new Set());
const userSearchLoading = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const existingMemberIds = computed(() => new Set(members.value.map(m => m.id)));

async function fetchProjects() {
  projectLoading.value = true;
  try {
    const res = await fetchGetProjectPage({ pageNum: 1, pageSize: 100 });
    if (res.data) {
      projects.value = res.data.rows || [];
    }
  } finally {
    projectLoading.value = false;
  }
}

async function selectProject(project: ProjectItem) {
  selectedProject.value = project;
  await fetchMembers(project.id);
}

async function fetchMembers(projectId: number) {
  memberLoading.value = true;
  try {
    const res = await fetchGetProjectMembers(projectId);
    if (res.data) {
      members.value = res.data;
    }
  } finally {
    memberLoading.value = false;
  }
}

function openCreate() {
  isEditing.value = false;
  formName.value = '';
  formDescription.value = '';
  formError.value = '';
  showFormModal.value = true;
}

function openEdit() {
  if (!selectedProject.value) return;
  isEditing.value = true;
  formName.value = selectedProject.value.name;
  formDescription.value = selectedProject.value.description;
  formError.value = '';
  showFormModal.value = true;
}

async function handleSubmit() {
  if (!formName.value.trim()) {
    formError.value = '请输入项目名称';
    return;
  }
  formError.value = '';
  formSubmitting.value = true;
  try {
    if (isEditing.value && selectedProject.value) {
      await fetchUpdateProject({ id: selectedProject.value.id, name: formName.value, description: formDescription.value });
    } else {
      await fetchCreateProject({ name: formName.value, description: formDescription.value });
    }
    showFormModal.value = false;
    await fetchProjects();
    // 更新选中项目
    if (isEditing.value && selectedProject.value) {
      const updated = await fetchGetProjectById(selectedProject.value.id);
      if (updated.data) {
        selectedProject.value = projects.value.find(p => p.id === selectedProject.value!.id) || null;
        if (updated.data) {
          const idx = projects.value.findIndex(p => p.id === selectedProject.value!.id);
          if (idx >= 0) projects.value[idx] = updated.data;
        }
      }
    }
  } catch {
    formError.value = '操作失败';
  } finally {
    formSubmitting.value = false;
  }
}

async function handleDelete() {
  if (!selectedProject.value) return;
  await fetchDeleteProject(selectedProject.value.id);
  selectedProject.value = null;
  members.value = [];
  await fetchProjects();
}

async function handleSearchUsers() {
  userSearchLoading.value = true;
  try {
    const res = await fetchGetUserList({ pageNum: 1, pageSize: 50, userName: searchKeyword.value || undefined });
    if (res.data) {
      userCandidates.value = (res.data.rows || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username
      }));
    }
  } finally {
    userSearchLoading.value = false;
  }
}

function handleSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => handleSearchUsers(), 300);
}

function toggleUserSelection(userId: number) {
  if (existingMemberIds.value.has(userId)) return;
  const next = new Set(selectedUserIds.value);
  if (next.has(userId)) next.delete(userId);
  else next.add(userId);
  selectedUserIds.value = next;
}

async function handleBatchAdd() {
  if (!selectedProject.value || selectedUserIds.value.size === 0) return;
  for (const userId of selectedUserIds.value) {
    await fetchAddProjectMember(selectedProject.value.id, userId);
  }
  showAddMember.value = false;
  searchKeyword.value = '';
  userCandidates.value = [];
  selectedUserIds.value = new Set();
  await fetchMembers(selectedProject.value.id);
}

async function handleRemoveMember(userId: number) {
  if (!selectedProject.value) return;
  await fetchRemoveProjectMember(selectedProject.value.id, userId);
  await fetchMembers(selectedProject.value.id);
}

onMounted(fetchProjects);
</script>

<template>
  <div class="flex h-full gap-4 lt-sm:flex-col">
    <!-- 左侧：项目列表 -->
    <NCard title="项目" size="small" :bordered="false" class="w-72 shrink-0 lt-sm:w-full card-wrapper">
      <template #header-extra>
        <NButton size="tiny" type="primary" @click="openCreate">新建</NButton>
      </template>
      <div class="flex-col-stretch gap-4px max-h-[calc(100vh-12rem)] overflow-y-auto">
        <div
          v-for="project in projects"
          :key="project.id"
          class="cursor-pointer rounded-md px-3 py-2 text-sm transition-colors"
          :class="selectedProject?.id === project.id
            ? 'bg-primary-50 font-medium text-primary-700'
            : 'text-slate-700 hover:bg-slate-100'"
          @click="selectProject(project)"
        >
          <div class="flex items-center justify-between">
            <span>{{ project.name }}</span>
            <NTag size="tiny" :bordered="false" round>
              {{ project.memberCount }}
            </NTag>
          </div>
        </div>
        <NEmpty v-if="projects.length === 0" description="暂无项目" />
      </div>
    </NCard>

    <!-- 右侧：成员管理 -->
    <NCard size="small" :bordered="false" class="flex-1 card-wrapper">
      <template v-if="selectedProject">
        <template #header>
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold">{{ selectedProject.name }}</span>
            <NTag size="tiny" round>{{ members.length }} 人</NTag>
          </div>
        </template>
        <template #header-extra>
          <NSpace size="small">
            <NButton size="tiny" @click="openEdit">编辑</NButton>
            <NButton size="tiny" type="primary" @click="showAddMember = true; handleSearchUsers()">添加成员</NButton>
            <NPopconfirm @positive-click="handleDelete">
              <template #trigger>
                <NButton size="tiny" type="error" text>删除</NButton>
              </template>
              确定要删除项目「{{ selectedProject.name }}」吗？
            </NPopconfirm>
          </NSpace>
        </template>
        <div v-if="memberLoading" class="flex-center py-20 text-sm text-slate-400">加载中...</div>
        <div v-else-if="members.length === 0" class="flex-center py-20">
          <NEmpty description="暂无成员" />
        </div>
        <div v-else class="overflow-y-auto" style="max-height: calc(100vh - 12rem)">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0"
          >
            <div class="flex-1">
              <div class="text-sm text-slate-900">{{ member.displayName || member.username }}</div>
              <div class="text-xs text-slate-400">{{ member.username }} {{ member.position ? '· ' + member.position : '' }}</div>
            </div>
            <div class="text-xs text-slate-400">{{ member.joinedAt?.slice(0, 10) || '-' }}</div>
            <NPopconfirm @positive-click="() => handleRemoveMember(member.id)">
              <template #trigger>
                <NButton size="tiny" type="error" text>移除</NButton>
              </template>
              确定要移除「{{ member.displayName || member.username }}」吗？
            </NPopconfirm>
          </div>
        </div>
      </template>
      <div v-else class="flex-center h-full">
        <NEmpty description="请选择左侧项目" />
      </div>
    </NCard>

    <!-- 新建/编辑项目弹窗 -->
    <NModal v-model:show="showFormModal" preset="card" :title="isEditing ? '编辑项目' : '新建项目'" style="width: 480px">
      <NSpace vertical size="medium">
        <div>
          <label class="mb-1 block text-sm">项目名称</label>
          <NInput v-model:value="formName" placeholder="请输入项目名称" />
        </div>
        <div>
          <label class="mb-1 block text-sm">描述</label>
          <NInput v-model:value="formDescription" type="textarea" :rows="2" placeholder="请输入描述" />
        </div>
        <div v-if="formError" class="text-sm text-red-500">{{ formError }}</div>
        <div class="flex justify-end gap-2">
          <NButton @click="showFormModal = false">取消</NButton>
          <NButton type="primary" :loading="formSubmitting" @click="handleSubmit">保存</NButton>
        </div>
      </NSpace>
    </NModal>

    <!-- 添加成员弹窗 -->
    <NModal v-model:show="showAddMember" preset="card" title="添加成员" style="width: 640px">
      <div class="flex gap-4">
        <!-- 候选列表 -->
        <div class="flex-1">
          <NInput
            v-model:value="searchKeyword"
            placeholder="搜索用户名"
            class="mb-3"
            @input="handleSearchInput"
          />
          <div class="max-h-64 overflow-y-auto rounded border border-slate-200">
            <div
              v-for="user in userCandidates"
              :key="user.id"
              class="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
              :class="existingMemberIds.has(user.id)
                ? 'cursor-not-allowed bg-slate-50 opacity-50'
                : selectedUserIds.has(user.id)
                  ? 'bg-primary-50'
                  : 'hover:bg-slate-50'"
              @click="!existingMemberIds.has(user.id) && toggleUserSelection(user.id)"
            >
              <input
                type="checkbox"
                class="h-3.5 w-3.5"
                :checked="selectedUserIds.has(user.id) || existingMemberIds.has(user.id)"
                :disabled="existingMemberIds.has(user.id)"
                @click.stop
                @change="!existingMemberIds.has(user.id) && toggleUserSelection(user.id)"
              />
              <span class="text-sm">{{ user.displayName || user.username }}</span>
              <span v-if="user.displayName" class="text-xs text-slate-400">{{ user.username }}</span>
              <span v-if="existingMemberIds.has(user.id)" class="ml-auto text-xs text-slate-400">已添加</span>
            </div>
            <div v-if="userSearchLoading" class="py-4 text-center text-sm text-slate-400">加载中...</div>
            <div v-else-if="userCandidates.length === 0" class="py-4 text-center text-sm text-slate-400">暂无用户</div>
          </div>
        </div>
        <!-- 已选列表 -->
        <div class="w-40 shrink-0">
          <div class="mb-2 text-sm font-medium">已选 {{ selectedUserIds.size }} 人</div>
          <div class="max-h-64 overflow-y-auto rounded border border-slate-200 bg-slate-50">
            <div
              v-for="user in userCandidates.filter(u => selectedUserIds.has(u.id))"
              :key="user.id"
              class="flex items-center justify-between px-3 py-2"
            >
              <span class="truncate text-sm">{{ user.displayName || user.username }}</span>
              <NButton size="tiny" text type="error" @click="toggleUserSelection(user.id)">×</NButton>
            </div>
            <div v-if="selectedUserIds.size === 0" class="flex-center py-8 text-sm text-slate-400">从左侧选择</div>
          </div>
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <NButton @click="showAddMember = false; userCandidates = []; selectedUserIds = new Set()">取消</NButton>
        <NButton type="primary" :disabled="selectedUserIds.size === 0" @click="handleBatchAdd">
          确认添加 ({{ selectedUserIds.size }})
        </NButton>
      </div>
    </NModal>
  </div>
</template>
