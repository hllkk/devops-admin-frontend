/**
 * 初始分组数据: 2 个根分组(本地/阿里云),每个根下放 2-3 个子分组。
 * 真实环境会走后端;此处用于 mock 演示。
 */
export function createInitialGroups(): Api.Server.ServerGroup[] {
  return [
    {
      id: 1,
      parentId: 0,
      name: '本地',
      orderNum: 1,
      children: [
        { id: 11, parentId: 1, name: '开发环境', orderNum: 1 },
        { id: 12, parentId: 1, name: '测试环境', orderNum: 2 },
        { id: 13, parentId: 1, name: '生产环境', orderNum: 3 }
      ]
    },
    {
      id: 2,
      parentId: 0,
      name: '阿里云',
      orderNum: 2,
      children: [
        { id: 21, parentId: 2, name: '华东1', orderNum: 1 },
        { id: 22, parentId: 2, name: '华南1', orderNum: 2 },
        { id: 23, parentId: 2, name: '华北2', orderNum: 3 }
      ]
    }
  ];
}

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