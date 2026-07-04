/**
 * 分组树工具函数(纯函数,无副作用)。
 * 从后端返回的分组树中提取扁平化的 { id, name } 列表,
 * 用于下拉框、搜索条件等场景。
 */

/** 扁平化分组树,转成 { id, name }[] */
export function flattenGroups(groups: Api.Server.ServerGroup[]): { id: CommonType.IdType; name: string }[] {
  const result: { id: CommonType.IdType; name: string }[] = [];
  const walk = (nodes: Api.Server.ServerGroup[]) => {
    for (const n of nodes) {
      result.push({ id: n.id, name: n.name });
      if (n.children?.length) walk(n.children);
    }
  };
  walk(groups);
  return result;
}
