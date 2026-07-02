export interface LocalFileEntry {
  id: string;
  name: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const filesApi = {
  list() {
    return request<{ files: LocalFileEntry[] }>("/api/files");
  },

  create(name: string, content: string) {
    return request<{ file: LocalFileEntry }>("/api/files", {
      method: "POST",
      body: JSON.stringify({ name, content }),
    });
  },

  open(id: string) {
    return request<{ file: LocalFileEntry; content: string }>(`/api/files/${id}`);
  },

  save(id: string, content: string) {
    return request<{ file: LocalFileEntry }>(`/api/files/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },

  rename(id: string, name: string) {
    return request<{ file: LocalFileEntry }>(`/api/files/${id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  reorder(ids: string[]) {
    return request<{ files: LocalFileEntry[] }>("/api/files/order", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
  },

  delete(id: string) {
    return request<{ files: LocalFileEntry[] }>(`/api/files/${id}`, {
      method: "DELETE",
    });
  },

  download(id: string) {
    window.location.href = `/api/files/${id}/download`;
  },
};
