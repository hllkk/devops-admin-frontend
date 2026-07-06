import { request } from '@/service/request';

/** 分页获取项目列表 */
export function fetchGetProjectPage(params: Api.Gateway.ProjectSearchParams) {
  return request<Api.Gateway.ProjectList>({
    url: '/gateway/project/page',
    method: 'get',
    params
  });
}

/** 根据 ID 获取项目 */
export function fetchGetProjectById(id: number) {
  return request<Api.Gateway.Project>({
    url: `/gateway/project/${id}`,
    method: 'get'
  });
}

/** 新增项目 */
export function fetchCreateProject(data: Api.Gateway.ProjectOperateParams) {
  return request<boolean>({
    url: '/gateway/project',
    method: 'post',
    data
  });
}

/** 修改项目 */
export function fetchUpdateProject(data: Api.Gateway.ProjectOperateParams) {
  return request<boolean>({
    url: '/gateway/project',
    method: 'put',
    data
  });
}

/** 删除项目 */
export function fetchDeleteProject(id: number) {
  return request<boolean>({
    url: `/gateway/project/${id}`,
    method: 'delete'
  });
}

/** 获取项目成员列表 */
export function fetchGetProjectMembers(projectId: number) {
  return request<Api.Gateway.ProjectMember[]>({
    url: `/gateway/project/${projectId}/members`,
    method: 'get'
  });
}

/** 添加项目成员 */
export function fetchAddProjectMember(projectId: number, userId: number) {
  return request<boolean>({
    url: '/gateway/project/member',
    method: 'post',
    data: { projectId, userId }
  });
}

/** 移除项目成员 */
export function fetchRemoveProjectMember(projectId: number, userId: number) {
  return request<boolean>({
    url: `/gateway/project/${projectId}/member/${userId}`,
    method: 'delete'
  });
}
