import api from './api';

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

    const { data } = await api.post('/upload', formData, {
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
    const { data } = await api.get('/documents');
    return data.documents;
  },

  async deleteDocument(documentId: string) {
    await api.delete(`/documents/${documentId}`);
  },

  async retryProcessing(documentId: string) {
    const { data } = await api.post(`/documents/${documentId}/retry`);
    return data;
  },
};
