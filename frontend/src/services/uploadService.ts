import api from './api';
import { API_ROUTES } from './apiRoutes';

export interface UploadResponse {
  document_id: string;
  filename: string;
  status: string;
  file_type: string;
  size: number;
}

export const uploadService = {
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post(API_ROUTES.UPLOAD, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });

    return data;
  },

  async getDocuments() {
    const { data } = await api.get(API_ROUTES.DOCUMENTS);
    return data.documents;
  },

  async deleteDocument(documentId: string) {
    await api.delete(API_ROUTES.DOCUMENT(documentId));
  },

  async retryProcessing(documentId: string) {
    const { data } = await api.post(API_ROUTES.DOCUMENT_RETRY(documentId));
    return data;
  },
};
