/** 文件预览分类 */
export type PreviewCategory = 'image' | 'pdf' | 'video' | 'audio' | 'office' | 'code' | 'markdown' | 'archive' | 'unknown';

/** Office 文档子类型 */
export type OfficeType = 'word' | 'excel' | 'ppt';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif'];

const PDF_EXTS = ['pdf'];

const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'ogv', 'flv', 'avi', 'mkv', 'mov', 'wmv', 'm4v', '3gp'];

const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'oga', 'm4a', 'wma', 'ape', 'opus'];

const MARKDOWN_EXTS = ['md', 'markdown'];

const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz', 'jar', 'iso', 'cab', 'ar', 'lzh', 'lz4'];

const OFFICE_EXTS: Record<OfficeType, string[]> = {
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx'],
  ppt: ['ppt', 'pptx']
};

const CODE_EXTS = [
  'txt', 'log', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'py', 'go', 'js', 'ts', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'sh', 'bash',
  'sql', 'css', 'scss', 'less', 'html', 'htm', 'vue',
  'jsx', 'tsx', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'lua', 'pl',
  'r', 'dart', 'properties', 'env', 'gitignore', 'dockerignore', 'editorconfig'
];

/** 根据文件名获取预览分类 */
export function getPreviewCategory(filename: string): PreviewCategory {
  const ext = getExtension(filename);
  if (!ext) return 'unknown';

  const lower = ext.toLowerCase();

  if (IMAGE_EXTS.includes(lower)) return 'image';
  if (PDF_EXTS.includes(lower)) return 'pdf';
  if (VIDEO_EXTS.includes(lower)) return 'video';
  if (AUDIO_EXTS.includes(lower)) return 'audio';
  if (getAllOfficeExts().includes(lower)) return 'office';
  if (MARKDOWN_EXTS.includes(lower)) return 'markdown';
  if (CODE_EXTS.includes(lower)) return 'code';
  if (ARCHIVE_EXTS.includes(lower)) return 'archive';

  return 'unknown';
}

/** 判断文件是否可预览 */
export function isPreviewable(filename: string): boolean {
  return getPreviewCategory(filename) !== 'unknown';
}

/** 获取 Office 子类型 */
export function getOfficeType(filename: string): OfficeType | null {
  const ext = getExtension(filename)?.toLowerCase();
  if (!ext) return null;

  for (const [officeType, exts] of Object.entries(OFFICE_EXTS)) {
    if (exts.includes(ext)) return officeType as OfficeType;
  }
  return null;
}

/** 获取 Monaco Editor 语言标识 */
export function getMonacoLanguage(filename: string): string {
  const ext = getExtension(filename)?.toLowerCase();
  if (!ext) return 'plaintext';

  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    vue: 'html', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'ini',
    md: 'markdown', markdown: 'markdown', sql: 'sql', py: 'python',
    go: 'go', java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', sh: 'shell', bash: 'shell', rs: 'rust', rb: 'ruby',
    php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala', lua: 'lua',
    pl: 'perl', r: 'r', dart: 'dart', ini: 'ini', cfg: 'ini', conf: 'ini',
    properties: 'ini', env: 'plaintext', log: 'plaintext', txt: 'plaintext'
  };

  return langMap[ext] || 'plaintext';
}

/** 获取文件扩展名（不含点） */
export function getExtension(filename: string): string | undefined {
  const parts = filename.split('.');
  if (parts.length < 2) return undefined;
  return parts[parts.length - 1];
}

function getAllOfficeExts(): string[] {
  return Object.values(OFFICE_EXTS).flat();
}

/** 判断文件是否为音频文件 */
export function isAudioFile(filename: string): boolean {
  const ext = getExtension(filename)?.toLowerCase();
  return ext ? AUDIO_EXTS.includes(ext) : false;
}
