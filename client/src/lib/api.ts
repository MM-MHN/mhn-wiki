const TOKEN_KEY = "wiki_token";

export type Role = "ADMIN" | "EDITOR" | "VIEWER";
export type EditorType = "MARKDOWN" | "WYSIWYG" | "HTML";

export type User = {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: Role;
  createdAt?: string;
  groupMembers?: { group: { id: string; name: string } }[];
};

export type Group = {
  id: string;
  name: string;
  description?: string | null;
  _count: { members: number };
  members?: {
    id: string;
    user: { id: string; name: string; username?: string; email?: string | null };
  }[];
};

export type Space = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isPrivate: boolean;
  _count?: { pages: number };
  pages?: PageNode[];
};

export type PageNode = {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  order: number;
  editorType?: EditorType;
  published?: boolean;
  updatedAt?: string;
};

export type Page = PageNode & {
  content: string;
  spaceId: string;
  published: boolean;
  author?: { id: string; name: string; email?: string } | null;
  space?: { id: string; name: string; slug: string };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string | null) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ user: User }>("/api/auth/me"),
  settings: () => request<{ settings: Record<string, string> }>("/api/settings"),
  spaces: () => request<{ spaces: Space[] }>("/api/spaces"),
  space: (slug: string) => request<{ space: Space }>(`/api/spaces/${slug}`),
  createSpace: (data: Partial<Space> & { name: string }) =>
    request<{ space: Space }>("/api/spaces", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSpace: (id: string, data: Partial<Space>) =>
    request<{ space: Space }>(`/api/spaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSpace: (id: string) =>
    request<void>(`/api/spaces/${id}`, { method: "DELETE" }),
  pageByPath: (spaceSlug: string, pageSlug: string) =>
    request<{ page: Page }>(`/api/pages/by-path/${spaceSlug}/${pageSlug}`),
  getPage: (id: string) => request<{ page: Page }>(`/api/pages/${id}`),
  createPage: (data: Record<string, unknown>) =>
    request<{ page: Page }>("/api/pages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePage: (id: string, data: Record<string, unknown>) =>
    request<{ page: Page }>(`/api/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deletePage: (id: string) =>
    request<void>(`/api/pages/${id}`, { method: "DELETE" }),
  uploadImage: async (file: File) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Upload failed (${res.status})`);
    }
    return res.json() as Promise<{ url: string; filename: string }>;
  },
  adminOverview: () =>
    request<{ stats: Record<string, number> }>("/api/admin/overview"),
  adminUsers: () => request<{ users: User[] }>("/api/admin/users"),
  adminGroups: () => request<{ groups: Group[] }>("/api/admin/groups"),
  adminSpaces: () => request<{ spaces: Space[] }>("/api/admin/spaces"),
  createUser: (data: {
    username: string;
    email?: string;
    name: string;
    password: string;
    role?: Role;
    groupIds?: string[];
  }) =>
    request<{ user: User }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUser: (
    id: string,
    data: {
      username?: string;
      email?: string | null;
      name?: string;
      password?: string;
      role?: Role;
      groupIds?: string[];
    }
  ) =>
    request<{ user: User }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    request<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
  createGroup: (data: {
    name: string;
    description?: string;
    memberIds?: string[];
  }) =>
    request<{ group: Group }>("/api/admin/groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateGroup: (
    id: string,
    data: {
      name?: string;
      description?: string | null;
      memberIds?: string[];
    }
  ) =>
    request<{ group: Group }>(`/api/admin/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteGroup: (id: string) =>
    request<void>(`/api/admin/groups/${id}`, { method: "DELETE" }),
};
