import { FILE_CATEGORIES } from './constants';

export type FileCategory = 'image' | 'document' | 'dataset' | 'code' | 'compressed' | 'unknown';

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getFileCategory(filename: string): FileCategory {
  const ext = getFileExtension(filename);
  if (FILE_CATEGORIES.IMAGE.includes(ext as any)) return 'image';
  if (FILE_CATEGORIES.DOCUMENT.includes(ext as any)) return 'document';
  if (FILE_CATEGORIES.DATASET.includes(ext as any)) return 'dataset';
  if (FILE_CATEGORIES.CODE.includes(ext as any)) return 'code';
  if (FILE_CATEGORIES.COMPRESSED.includes(ext as any)) return 'compressed';
  return 'unknown';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getLanguageFromExtension(ext: string): string {
  const map: Record<string, string> = {
    py: 'python', java: 'java', js: 'javascript', ts: 'typescript',
    c: 'c', cpp: 'cpp', html: 'html', css: 'css', sql: 'sql',
    json: 'json', md: 'markdown', txt: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

export function isAcceptedFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  const allExts = [
    ...FILE_CATEGORIES.IMAGE,
    ...FILE_CATEGORIES.DOCUMENT,
    ...FILE_CATEGORIES.DATASET,
    ...FILE_CATEGORIES.CODE,
    ...FILE_CATEGORIES.COMPRESSED,
  ];
  return allExts.includes(ext as any);
}
