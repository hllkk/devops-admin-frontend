export namespace Editor {
  /** 标签页 */
  interface Tab {
    id: string;
    fileId: CommonType.IdType;
    fileName: string;
    filePath: string;
    language: string;
    isModified: boolean;
    contentType: string;
    size: number;
    updateTime: string;
  }

  /** 文件树节点 */
  interface FileTreeNode {
    id: CommonType.IdType;
    name: string;
    path: string;
    isDir: boolean;
    hasChildren: boolean;
    size: number;
    contentType: string;
    updateTime: string;
  }

  /** 历史版本 */
  interface HistoryVersion {
    id: CommonType.IdType;
    fileId: CommonType.IdType;
    fileName: string;
    size: number;
    operator: string;
    createTime: string;
  }

  /** 保存结果 */
  interface SaveResult {
    versionId: CommonType.IdType;
    createTime: string;
  }

  /** 恢复结果 */
  interface RestoreResult {
    [key: string]: unknown;
  }
}