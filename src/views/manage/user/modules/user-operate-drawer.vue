<script setup lang="ts">
import type { PasswordPolicy } from '@/hooks/common/form';
import { computed, onMounted, ref, watch } from 'vue';
import { jsonClone } from '@sa/utils';
import { useLoading } from '@sa/hooks';
import { fetchCreateUser, fetchGetSystemSettings, fetchGetUserInfo, fetchUpdateUser, fetchGetRoleSelect, fetchRestoreDeletedUser } from '@/service/api/system';
import { buildPasswordHint, createDynamicPwdRule, useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'UserOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.System.User | null;
  /** the dept tree data */
  deptData?: Api.Common.CommonTreeRecord;
  /** the dept id */
  deptId?: CommonType.IdType | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { loading, startLoading, endLoading } = useLoading();
const { loading: deptLoading, startLoading: startDeptLoading, endLoading: endDeptLoading } = useLoading();
const { formRef, validate, restoreValidation } = useNaiveForm();
const { createRequiredRule, patternRules } = useFormRules();

const title = computed(() => {
  const titles: Record<NaiveUI.TableOperateType, string> = {
    add: $t('page.system.user.addUser'),
    edit: $t('page.system.user.editUser')
  };
  return titles[props.operateType];
});

type Model = Api.System.UserOperateParams;

const model = ref<Model>(createDefaultModel());

const roleOptions = ref<CommonType.Option<CommonType.IdType>[]>([]);

// 配额相关状态
const globalQuotaGB = ref(10); // 全局默认配额（GB）
const usedSpaceGB = ref(0); // 已用空间（GB）

function createDefaultModel(): Model {
  return {
    deptId: null,
    userName: '',
    nickName: '',
    email: '',
    phonenumber: '',
    sex: '0',
    password: '',
    status: '0',
    roleIds: [],
    postIds: [],
    remark: '',
    quota: 0
  };
}

type RuleKey = Extract<keyof Model, 'userName' | 'nickName' | 'password' | 'status' | 'phonenumber' | 'roleIds'>;

const passwordPolicy = ref<PasswordPolicy>({
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: true,
  requireSpecial: true
});

const pwdHint = ref('至少8位，需包含数字和特殊字符');

const rules = ref<Record<RuleKey, App.Global.FormRule[]>>({
  userName: [createRequiredRule($t('page.system.user.form.userName.required'))],
  nickName: [createRequiredRule($t('page.system.user.form.nickName.required'))],
  password: [{ ...patternRules.pwd, required: props.operateType === 'add' }],
  phonenumber: [patternRules.phone],
  status: [createRequiredRule($t('page.system.user.form.status.required'))],
  roleIds: [{ ...createRequiredRule('请选择角色'), type: 'array' }]
});

async function loadPasswordPolicy() {
  try {
    const { data, error } = await fetchGetSystemSettings();
    if (!error && data) {
      // 加载密码策略
      if (data.security) {
        const sec = data.security;
        const policy: PasswordPolicy = {
          minLength: sec.passwordMinLength || 8,
          requireUppercase: sec.passwordRequireUppercase ?? false,
          requireLowercase: sec.passwordRequireLowercase ?? false,
          requireDigit: sec.passwordRequireDigit ?? true,
          requireSpecial: sec.passwordRequireSpecial ?? true
        };
        passwordPolicy.value = policy;
        pwdHint.value = buildPasswordHint(policy);
        rules.value = {
          ...rules.value,
          password: [{ ...createDynamicPwdRule(policy), required: props.operateType === 'add' }]
        };
      }
      // 加载全局默认配额
      if (data.disk?.storageQuota) {
        globalQuotaGB.value = data.disk.storageQuota;
      }
    }
  } catch {
    // 使用默认规则
  }
}

async function getUserInfo(id: CommonType.IdType) {
  startLoading();
  const { error, data } = await fetchGetUserInfo(id);
  if (!error) {
    model.value.roleIds = data.roleIds;
    model.value.postIds = data.postIds;
  }
  endLoading();
}

async function getRoleOptions() {
  startLoading();
  const { error, data } = await fetchGetRoleSelect();
  if (!error) {
    roleOptions.value = data.map(role => ({
      label: role.roleName,
      value: role.roleId
    }));
  }
  endLoading();
}

async function handleUpdateModelWhenEdit() {
  model.value = createDefaultModel();
  // 获取角色列表（添加和编辑都需要）
  await getRoleOptions();

  if (props.operateType === 'add') {
    model.value.deptId = props.deptId;
    usedSpaceGB.value = 0; // 新用户已用空间为 0
    return;
  }

  if (props.operateType === 'edit' && props.rowData) {
    startDeptLoading();
    Object.assign(model.value, jsonClone(props.rowData));
    model.value.password = '';
    // 将字节转换为 GB 显示（如果 quota 存在且大于 0）
    if (model.value.quota && model.value.quota > 0) {
      model.value.quota = Math.round(model.value.quota / (1024 * 1024 * 1024));
    } else {
      model.value.quota = 0;
    }
    // 获取已用空间（字节转GB）
    if (props.rowData?.takeUpSpace) {
      usedSpaceGB.value = Math.round(props.rowData.takeUpSpace / (1024 * 1024 * 1024));
    } else {
      usedSpaceGB.value = 0;
    }
    await getUserInfo(props.rowData.userId);
    endDeptLoading();
  }
}

function closeDrawer() {
  visible.value = false;
}

/** 显示恢复用户确认对话框 */
const showRestoreConfirm = ref(false);
const pendingUserData = ref<Api.System.RestoreUserParams | null>(null);

async function handleSubmit() {
  await validate();

  const { userId, deptId, userName, nickName, email, phonenumber, sex, password, status, roleIds, postIds, remark, quota } =
    model.value;

  // 将 GB 转换为字节
  const quotaBytes = quota ? quota * 1024 * 1024 * 1024 : 0;

  // request
  if (props.operateType === 'add') {
    const { error } = await fetchCreateUser({
      deptId,
      userName,
      password,
      nickName,
      email,
      phonenumber,
      sex,
      status,
      roleIds,
      postIds,
      remark,
      quota: quotaBytes
    });
    if (error) {
      // 检测是否是软删除用户冲突
      const errMsg = (error as any)?.response?.data?.msg || error?.message || '';
      if (errMsg.startsWith('USER_DELETED_CONFLICT:')) {
        pendingUserData.value = {
          userName,
          password,
          nickName,
          email,
          phonenumber,
          sex,
          deptId,
          status,
          roleIds,
          postIds
        };
        showRestoreConfirm.value = true;
        return;
      }
      return;
    }
  }

  if (props.operateType === 'edit') {
    const { error } = await fetchUpdateUser({
      userId,
      deptId,
      userName,
      nickName,
      email,
      phonenumber,
      sex,
      status,
      roleIds,
      postIds,
      remark,
      quota: quotaBytes
    });
    if (error) return;
  }

  window.$message?.success($t('common.updateSuccess'));
  closeDrawer();
  emit('submitted');
}

/** 恢复已删除用户 */
async function handleRestoreUser() {
  if (!pendingUserData.value) return;

  const { error } = await fetchRestoreDeletedUser(pendingUserData.value);
  if (error) return;

  window.$message?.success('用户恢复成功');
  showRestoreConfirm.value = false;
  pendingUserData.value = null;
  closeDrawer();
  emit('submitted');
}

/** 创建新用户（强制创建，即使存在同名已删除用户） */
async function handleForceCreateUser() {
  if (!pendingUserData.value) return;

  const { userName, password, nickName, email, phonenumber, sex, deptId, status, roleIds, postIds } =
    pendingUserData.value;

  const { error } = await fetchCreateUser({
    deptId,
    userName,
    password,
    nickName,
    email,
    phonenumber,
    sex,
    status,
    roleIds,
    postIds,
    forceCreate: true
  });
  if (error) return;

  window.$message?.success('用户创建成功');
  showRestoreConfirm.value = false;
  pendingUserData.value = null;
  closeDrawer();
  emit('submitted');
}

/** 取消操作 */
function handleCancelConflict() {
  showRestoreConfirm.value = false;
  pendingUserData.value = null;
}


onMounted(() => {
  loadPasswordPolicy();
});
watch(visible, () => {
  if (visible.value) {
    handleUpdateModelWhenEdit();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="800" class="max-w-90%">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NSpin :show="loading">
        <NForm ref="formRef" :model="model" :rules="rules">
          <NFormItem :label="$t('page.system.user.nickName')" path="nickName">
            <NInput v-model:value="model.nickName" :placeholder="$t('page.system.user.form.nickName.required')" />
          </NFormItem>
          <NFormItem :label="$t('page.system.user.deptName')" path="deptId">
            <NTreeSelect
              v-model:value="model.deptId"
              :loading="deptLoading"
              clearable
              :options="deptData as []"
              label-field="label"
              key-field="id"
              :default-expanded-keys="deptData?.length ? [deptData[0].id] : []"
              :placeholder="$t('page.system.user.form.deptId.required')"
            />
          </NFormItem>
          <NFormItem :label="$t('page.system.user.phonenumber')" path="phonenumber">
            <NInput v-model:value="model.phonenumber" :placeholder="$t('page.system.user.form.phonenumber.required')" />
          </NFormItem>
          <NFormItem :label="$t('page.system.user.email')" path="email">
            <NInput v-model:value="model.email" :placeholder="$t('page.system.user.form.email.required')" />
          </NFormItem>
          <NFormItem v-if="operateType === 'add'" :label="$t('page.system.user.userName')" path="userName">
            <NInput v-model:value="model.userName" :placeholder="$t('page.system.user.form.userName.required')" />
          </NFormItem>
          <NFormItem v-if="operateType === 'add'" :label="$t('page.system.user.password')" path="password">
            <NInput
              v-model:value="model.password"
              type="password"
              show-password-on="click"
              :input-props="{ autocomplete: 'off' }"
              :placeholder="$t('page.system.user.form.password.required')"
            />
            <NText depth="3" class="ml-8px text-12px whitespace-nowrap">{{ pwdHint }}</NText>
          </NFormItem>
          <NFormItem :label="$t('page.system.user.sex')" path="sex">
            <DictRadio
              v-model:value="model.sex"
              dict-code="sys_user_sex"
              :placeholder="$t('page.system.user.form.sex.required')"
            />
          </NFormItem>
          <NFormItem :label="$t('page.system.user.postIds')" path="postIds">
            <PostSelect v-model:value="model.postIds" :dept-id="model.deptId" multiple clearable />
          </NFormItem>
          <NFormItem :label="$t('page.system.user.roleIds')" path="roleIds">
            <NSelect
              v-model:value="model.roleIds"
              :loading="loading"
              :options="roleOptions"
              multiple
              clearable
              placeholder="请选择角色"
            />
          </NFormItem>
          <NFormItem :label="$t('page.system.user.status')" path="status">
            <DictRadio v-model:value="model.status" dict-code="sys_normal_disable" />
          </NFormItem>
          <NFormItem label="存储配额" path="quota">
            <NInputNumber
              v-model:value="model.quota"
              :min="operateType === 'edit' ? usedSpaceGB : 0"
              :precision="0"
              class="max-w-200px"
            >
              <template #suffix>GB</template>
            </NInputNumber>
            <div class="text-12px text-[var(--n-text-color-3)] mt-4px flex flex-col gap-2px">
              <span>0 表示使用全局默认配额（当前 {{ globalQuotaGB }} GB）</span>
              <span v-if="operateType === 'edit' && usedSpaceGB > 0" class="text-warning">
                已用空间 {{ usedSpaceGB }} GB，配额不能低于此值
              </span>
            </div>
          </NFormItem>
          <NFormItem :label="$t('page.system.user.remark')" path="remark">
            <NInput v-model:value="model.remark" :placeholder="$t('page.system.user.form.remark.required')" />
          </NFormItem>
        </NForm>
      </NSpin>
      <template #footer>
        <NSpace :size="16">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.save') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>

  <!-- 恢复已删除用户确认对话框 -->
  <NModal v-model:show="showRestoreConfirm" preset="card" title="用户名冲突" class="w-500px" :mask-closable="false">
    <div class="py-4">
      <p>该用户名 <strong>{{ pendingUserData?.userName }}</strong> 已被删除的用户占用。</p>
      <p class="mt-2">请选择操作方式：</p>
      <ul class="list-disc pl-6 mt-2 text-gray-500">
        <li>恢复旧用户：使用当前信息恢复该用户（保留原ID和关联数据）</li>
        <li>创建新用户：创建同名新用户（旧用户数据仍保留但不可见）</li>
        <li>取消：修改用户名后重新提交</li>
      </ul>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleCancelConflict">取消</NButton>
        <NButton type="warning" @click="handleForceCreateUser">创建新用户</NButton>
        <NButton type="primary" @click="handleRestoreUser">恢复旧用户</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
