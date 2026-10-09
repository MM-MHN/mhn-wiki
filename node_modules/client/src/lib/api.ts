const TOKEN_KEY = "wiki_token";

/** Keep in sync with server upload limit (multer fileSize). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Keep in sync with express.json({ limit }). */
export const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024;

export type Role = "ADMIN" | "EDITOR" | "VIEWER";
export type EditorType = "MARKDOWN" | "WYSIWYG" | "HTML";
export type PermissionLevel = "NONE" | "VIEW" | "EDIT" | "MANAGE";

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

export type SpaceMember = {
  id: string;
  spaceId?: string;
  userId?: string | null;
  groupId?: string | null;
  level: PermissionLevel;
  user?: { id: string; name: string; username: string; role?: Role } | null;
  group?: { id: string; name: string } | null;
};

export type Space = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isPrivate: boolean;
  myAccess?: PermissionLevel;
  _count?: { pages: number; members?: number };
  pages?: PageNode[];
  members?: SpaceMember[];
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

export type PageRevisionAction = "CREATED" | "UPDATED" | "RESTORED";

export type PageRevisionSummary = {
  id: string;
  pageId: string;
  action: PageRevisionAction;
  title: string;
  slug: string;
  editorType: EditorType;
  published: boolean;
  parentId: string | null;
  order: number;
  createdAt: string;
  editedBy?: { id: string; name: string; username: string } | null;
};

export type PageRevision = PageRevisionSummary & {
  content: string;
};

export type SystemLogCategory =
  | "AUTH"
  | "SPACE"
  | "PAGE"
  | "USER"
  | "GROUP"
  | "ACCESS";

export type SystemLog = {
  id: string;
  category: SystemLogCategory;
  action: string;
  message: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: Role | null;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: string | null;
  createdAt: string;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0B";
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? Math.round(kb) : Number(kb.toFixed(1))}KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Number(mb.toFixed(1))}MB`;
}

function sizeLimitMessage(maxBytes: number, uploadedBytes?: number): string {
  const max = formatBytes(maxBytes);
  if (uploadedBytes != null) {
    return `Exceeds maximum allowed size of ${max}; uploaded size was ${formatBytes(uploadedBytes)}`;
  }
  return `Exceeds maximum allowed size of ${max}`;
}

async function readErrorBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const trimmed = text.trim().slice(0, 300);
    return trimmed ? { error: trimmed } : {};
  }
}

function pickServerMessage(data: Record<string, unknown>): string {
  for (const key of ["error", "message", "detail", "details"] as const) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveErrorMessage(
  res: Response,
  data: Record<string, unknown>,
  fallback: string,
  opts?: { uploadedBytes?: number; maxBytes?: number }
): string {
  const raw = pickServerMessage(data);
  const limit =
    typeof data.limit === "number"
      ? data.limit
      : typeof data.maxBytes === "number"
        ? data.maxBytes
        : opts?.maxBytes;
  const size =
    typeof data.size === "number"
      ? data.size
      : typeof data.length === "number"
        ? data.length
        : opts?.uploadedBytes;

  const looksLikeSizeError =
    res.status === 413 ||
    /too large|file size|entity too large|maximum allowed size|payload|LIMIT_FILE_SIZE/i.test(
      raw
    );

  if (looksLikeSizeError) {
    if (limit != null) return sizeLimitMessage(limit, size ?? undefined);
    if (raw) return raw;
    return "Request or file is too large.";
  }

  const countLimit =
    typeof data.maxCount === "number"
      ? data.maxCount
      : typeof data.limitCount === "number"
        ? data.limitCount
        : undefined;
  if (
    /file count|too many files|LIMIT_FILE_COUNT|maximum.*count/i.test(raw) ||
    countLimit != null
  ) {
    if (countLimit != null) {
      return `Exceeds maximum allowed count of ${countLimit}${
        typeof data.count === "number" ? `; uploaded count was ${data.count}` : ""
      }`;
    }
    if (raw) return raw;
  }

  if (raw) return raw;

  if (res.status === 500) {
    return "Internal server error. Please try again or contact an administrator.";
  }
  if (res.status === 413 && opts?.maxBytes != null) {
    return sizeLimitMessage(opts.maxBytes, opts.uploadedBytes);
  }

  return fallback || `Request failed (${res.status})`;
}

async function throwHttpError(
  res: Response,
  fallback: string,
  opts?: { uploadedBytes?: number; maxBytes?: number }
): Promise<never> {
  const data = await readErrorBody(res);
  throw new Error(resolveErrorMessage(res, data, fallback, opts));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }

  if (!res.ok) {
    const bodyBytes =
      typeof init.body === "string"
        ? new TextEncoder().encode(init.body).length
        : undefined;
    await throwHttpError(res, `Request failed (${res.status})`, {
      uploadedBytes: bodyBytes,
      maxBytes: MAX_JSON_BODY_BYTES,
    });
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
  space: (slug: string, opts?: { manage?: boolean }) =>
    request<{ space: Space }>(
      `/api/spaces/${slug}${opts?.manage ? "?manage=1" : ""}`
    ),
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
  pageHistory: (pageId: string) =>
    request<{ revisions: PageRevisionSummary[] }>(
      `/api/pages/${pageId}/history`
    ),
  pageRevision: (pageId: string, revisionId: string) =>
    request<{ revision: PageRevision }>(
      `/api/pages/${pageId}/history/${revisionId}`
    ),
  restorePageRevision: (pageId: string, revisionId: string) =>
    request<{ page: Page }>(
      `/api/pages/${pageId}/history/${revisionId}/restore`,
      { method: "POST" }
    ),
  uploadImage: async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(sizeLimitMessage(MAX_UPLOAD_BYTES, file.size));
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const body = new FormData();
    body.append("file", file);

    let res: Response;
    try {
      res = await fetch("/api/uploads", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
    } catch {
      throw new Error("Network error while uploading. Check your connection and try again.");
    }

    if (!res.ok) {
      await throwHttpError(res, `Upload failed (${res.status})`, {
        uploadedBytes: file.size,
        maxBytes: MAX_UPLOAD_BYTES,
      });
    }
    return res.json() as Promise<{ url: string; filename: string }>;
  },
  adminOverview: () =>
    request<{ stats: Record<string, number> }>("/api/admin/overview"),
  adminSystemLogs: (params?: {
    category?: SystemLogCategory;
    q?: string;
    limit?: number;
    offset?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.q) sp.set("q", params.q);
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.offset != null) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<{
      logs: SystemLog[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/admin/logs${qs ? `?${qs}` : ""}`);
  },
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
  adminSpaceMembers: (spaceId: string) =>
    request<{ members: SpaceMember[] }>(
      `/api/admin/spaces/${spaceId}/members`
    ),
  addSpaceMember: (
    spaceId: string,
    data: { userId?: string; groupId?: string; level: PermissionLevel }
  ) =>
    request<{ member: SpaceMember }>(`/api/admin/spaces/${spaceId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSpaceMember: (
    spaceId: string,
    memberId: string,
    data: { level: PermissionLevel }
  ) =>
    request<{ member: SpaceMember }>(
      `/api/admin/spaces/${spaceId}/members/${memberId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    ),
  deleteSpaceMember: (spaceId: string, memberId: string) =>
    request<void>(`/api/admin/spaces/${spaceId}/members/${memberId}`, {
      method: "DELETE",
    }),
};
