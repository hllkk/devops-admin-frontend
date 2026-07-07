/**
 * Office 文档编辑器类型定义
 */

/** Office 文档类型 */
export type DocumentType = 'text' | 'spreadsheet' | 'presentation';

/** 文档配置 */
export interface DocumentConfig {
  /** 文件类型 (docx, xlsx, pptx 等) */
  fileType: string;
  /** 文档唯一标识，用于区分不同版本 */
  key: string;
  /** 文档标题 */
  title: string;
  /** 文档下载 URL */
  url: string;
}

/** 用户信息 */
export interface UserInfo {
  /** 用户 ID */
  id: string;
  /** 用户名 */
  name: string;
  /** 用户头像 URL */
  image?: string;
}

/** 关闭按钮配置 */
export interface CloseConfig {
  /** 是否显示 */
  visible: boolean;
  /** 按钮文本 */
  text?: string;
}

/** 关于配置 */
export interface AboutConfig {
  /** 是否显示 */
  visible: boolean;
  /** 是否显示许可证信息 */
  license?: boolean;
}

/** 插件配置 */
export interface PluginsConfig {
  /** 是否启用插件 */
  autostart?: string[];
  /** 插件 URL */
  pluginsData?: string[];
}

/** 自定义选项 */
export interface CustomizationOptions {
  /** 自动保存 */
  autosave: boolean;
  /** 强制保存 */
  forcesave: boolean;
  /** 显示批注 */
  comments: boolean;
  /** 紧凑头部 */
  compactHeader: boolean;
  /** 紧凑工具栏 */
  compactToolbar: boolean;
  /** 兼容特性 */
  compatibleFeatures: boolean;
  /** 帮助按钮 */
  help: boolean;
  /** 隐藏右侧菜单 */
  hideRightMenu: boolean;
  /** 隐藏标尺 */
  hideRulers: boolean;
  /** 提交表单 */
  submitForm: boolean;
  /** 关于对话框 */
  about?: AboutConfig | null;
  /** 反馈按钮 */
  feedback: boolean;
  /** 关闭按钮配置 */
  close: CloseConfig;
  /** UI 主题 */
  uiTheme: 'default-light' | 'default-dark' | 'theme-dark' | 'theme-light';
  /** 宏设置 */
  macros: boolean;
  /** 插件设置 */
  plugins: PluginsConfig;
}

/** 最近文件 */
export interface RecentFile {
  /** 文件标题 */
  title: string;
  /** 文件 URL */
  url: string;
  /** 文件类型 */
  fileType?: string;
}

/** 编辑器选项 */
export interface EditorOptions {
  /** 编辑模式: edit 或 view */
  mode: 'edit' | 'view';
  /** 语言: zh, en 等 */
  lang: string;
  /** 当前用户信息 */
  user: UserInfo;
  /** 保存回调 URL */
  callbackUrl?: string | null;
  /** 自定义配置 */
  customization?: CustomizationOptions;
  /** 创建新文档时的模板 URL */
  createUrl?: string;
  /** 最近文件列表 */
  recent?: RecentFile[];
}

/** 文档状态事件 */
export interface DocumentStateEvent {
  /** 是否已保存 */
  data: boolean;
}

/** 历史数据事件 */
export interface HistoryDataEvent {
  /** 版本号 */
  data: number;
}

/** 错误事件 */
export interface ErrorEvent {
  /** 错误码 */
  data: {
    errorCode: number;
    errorDescription?: string;
  };
}

/** 信息事件 */
export interface InfoEvent {
  /** 信息数据 */
  data: {
    type: string;
    message?: string;
  };
}

/** 编辑器事件 */
export interface EditorEvents {
  /** 应用就绪 */
  onAppReady?: () => void;
  /** 文档就绪 */
  onDocumentReady?: () => void;
  /** 文档状态变化 */
  onDocumentStateChange?: (event: DocumentStateEvent) => void;
  /** 请求历史版本 */
  onRequestHistory?: () => void;
  /** 请求历史版本数据 */
  onRequestHistoryData?: (event: HistoryDataEvent) => void;
  /** 关闭历史版本 */
  onRequestHistoryClose?: () => void;
  /** 请求关闭 */
  onRequestClose?: () => void;
  /** 请求保存 */
  onRequestSave?: () => void;
  /** 请求强制保存 */
  onRequestForceSave?: () => void;
  /** 错误事件 */
  onError?: (event: ErrorEvent) => void;
  /** 信息事件 */
  onInfo?: (event: InfoEvent) => void;
  /** 协作变化 */
  onCollaborativeChanges?: () => void;
}

/** 编辑器完整配置 */
export interface EditorConfig {
  /** 文档配置 */
  document: DocumentConfig;
  /** 编辑器选项 */
  editorConfig: EditorOptions;
  /** JWT Token (可选，启用 JWT 时必填) */
  token?: string;
  /** 事件回调 */
  events?: EditorEvents;
  /** 编辑器类型: desktop 或 mobile */
  type?: 'desktop' | 'mobile';
}

/** 服务器配置 */
export interface ServerConfig {
  /** OnlyOffice Document Server 地址 */
  documentServer: string;
  /** 回调服务器地址 */
  callbackServer: string;
  /** 是否启用 JWT Token */
  tokenEnabled: boolean;
}

/** 健康检查响应 */
export interface HealthCheckResult {
  /** OnlyOffice 是否可用 */
  available: boolean;
  /** 响应时间（毫秒） */
  responseMs?: number;
  /** 版本信息 */
  version?: string;
  /** 错误信息 */
  error?: string;
}

/** 历史变更 */
export interface HistoryChange {
  /** 变更用户 */
  user: UserInfo;
  /** 变更时间 */
  created: string;
  /** 变更内容标识 */
  id?: string;
}

/** 历史版本 */
export interface HistoryVersion {
  /** 版本号 */
  version: number | string;
  /** 版本标识 */
  key: string;
  /** 版本 URL */
  url: string;
  /** 创建时间 */
  createTime: string;
  /** JWT Token */
  token?: string;
  /** 文件类型 */
  fileType?: string;
  /** 操作者 */
  operator?: string;
  /** 版本描述 */
  changes?: HistoryChange[];
}

/** 历史响应数据 */
export interface HistoryResponse {
  /** 当前版本 */
  currentVersion: number;
  /** 历史版本列表 */
  history: HistoryVersion[];
}

/** 支持的 Office 文件格式 */
export interface SupportedFormats {
  word: string[];
  excel: string[];
  ppt: string[];
}

/** 编辑器实例接口 */
export interface DocEditorInstance {
  /** 销毁编辑器 */
  destroyEditor: () => void;
  /** 设置历史数据 */
  setHistoryData: (config: HistoryVersion) => void;
  /** 刷新历史版本 */
  refreshHistory: (data: HistoryResponse) => void;
}

/** DocsAPI 接口 */
export interface DocsAPI {
  /** 创建编辑器 */
  DocEditor: new (id: string, config: EditorConfig) => DocEditorInstance;
}

/** 扩展 Window 类型 */
declare global {
  interface Window {
    DocsAPI?: DocsAPI;
    shareId?: string;
  }
}