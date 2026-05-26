import { create } from 'zustand';

// ─── Image Attachment (for multimodal chat) ─────────────────────
export interface ImageAttachment {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  size: number;
  preview: string;   // Object URL for UI preview
  base64: string;    // Base64 data for API payload
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

// ─── Document Upload (for RAG ingestion) ─────────────────────────
export interface UploadFile {
  id: string;
  file: File;
  filename: string;
  fileType: string;
  size: number;
  category: 'image' | 'document' | 'dataset' | 'code' | 'compressed' | 'unknown';
  status: 'queued' | 'uploading' | 'processing' | 'parsed' | 'error';
  progress: number;
  documentId?: string;
  error?: string;
  preview?: string;
}

// ─── Accepted image types ────────────────────────────────────────
const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
]);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB

// ─── Validation result ──────────────────────────────────────────
interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ─── Store ───────────────────────────────────────────────────────
interface UploadState {
  // Document uploads (RAG)
  files: UploadFile[];
  isUploading: boolean;

  // Image attachments (multimodal chat) — GLOBAL, persists across tabs
  imageAttachments: ImageAttachment[];
  isLoadingImages: boolean;

  // Document actions
  addFiles: (files: UploadFile[]) => void;
  updateFile: (id: string, update: Partial<UploadFile>) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  setUploading: (uploading: boolean) => void;
  retryFile: (id: string) => void;

  // Image attachment actions (global, survives tab switches)
  addImageAttachments: (files: File[]) => Promise<void>;
  removeImageAttachment: (id: string) => void;
  clearImageAttachments: () => void;
  validateImage: (file: File) => ValidationResult;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Convert a File to a base64 data-URL string */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Validate that a file looks like a valid image we can send */
function validateImageFile(file: File): ValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, error: `Unsupported image type: ${file.type}. Accepted: PNG, JPG, JPEG, WEBP` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 20 MB` };
  }
  if (file.size === 0) {
    return { valid: false, error: 'Image file is empty or corrupted.' };
  }
  return { valid: true };
}

// ─── Zustand Store ──────────────────────────────────────────────
export const useUploadStore = create<UploadState>((set, get) => ({
  // Document state
  files: [],
  isUploading: false,

  // Image attachment state (GLOBAL)
  imageAttachments: [],
  isLoadingImages: false,

  // ─── Document Actions ──────────────────────────────────────
  addFiles: (files) => set((s) => ({ files: [...s.files, ...files] })),

  updateFile: (id, update) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, ...update } : f)),
    })),

  removeFile: (id) =>
    set((s) => ({ files: s.files.filter((f) => f.id !== id) })),

  clearFiles: () => set({ files: [] }),
  setUploading: (isUploading) => set({ isUploading }),

  retryFile: (id) =>
    set((s) => ({
      files: s.files.map((f) =>
        f.id === id ? { ...f, status: 'queued', progress: 0, error: undefined } : f
      ),
    })),

  // ─── Image Attachment Actions (GLOBAL) ─────────────────────
  validateImage: validateImageFile,

  addImageAttachments: async (files: File[]) => {
    const state = get();
    const existingNames = new Set(state.imageAttachments.map((a) => a.filename));

    // Filter out duplicates
    const uniqueFiles = files.filter((f) => !existingNames.has(f.name));
    if (uniqueFiles.length === 0) return;

    // Create placeholder entries immediately (so UI shows loading state)
    const placeholders: ImageAttachment[] = uniqueFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      preview: URL.createObjectURL(file),
      base64: '',
      status: 'loading' as const,
    }));

    set((s) => ({
      imageAttachments: [...s.imageAttachments, ...placeholders],
      isLoadingImages: true,
    }));

    // Convert each to base64 in parallel
    const results = await Promise.allSettled(
      placeholders.map(async (ph) => {
        const base64 = await fileToBase64(ph.file);
        return { id: ph.id, base64 };
      })
    );

    set((s) => ({
      imageAttachments: s.imageAttachments.map((att) => {
        const result = results.find((r) => {
          if (r.status === 'fulfilled') return r.value.id === att.id;
          return false;
        });
        if (result && result.status === 'fulfilled') {
          return { ...att, base64: result.value.base64, status: 'ready' as const };
        }
        // Check if it was a rejected conversion
        const rejected = results.find(
          (r) => r.status === 'rejected' && placeholders.some((p) => p.id === att.id)
        );
        if (rejected && att.status === 'loading') {
          return { ...att, status: 'error' as const, error: 'Failed to convert image' };
        }
        return att;
      }),
      isLoadingImages: false,
    }));
  },

  removeImageAttachment: (id) =>
    set((s) => {
      const att = s.imageAttachments.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return { imageAttachments: s.imageAttachments.filter((a) => a.id !== id) };
    }),

  clearImageAttachments: () =>
    set((s) => {
      // Revoke all object URLs to prevent memory leaks
      s.imageAttachments.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
      return { imageAttachments: [] };
    }),
}));
