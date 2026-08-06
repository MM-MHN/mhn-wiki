import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth";
import { api, type Group, type Role, type User } from "@/lib/api";

type UserForm = {
  username: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  groupIds: string[];
};

type GroupForm = {
  name: string;
  description: string;
  memberIds: string[];
};

const emptyUserForm = (): UserForm => ({
  username: "",
  name: "",
  email: "",
  password: "",
  role: "VIEWER",
  groupIds: [],
});

const emptyGroupForm = (): GroupForm => ({
  name: "",
  description: "",
  memberIds: [],
});

export function AdminUsersPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [userFormError, setUserFormError] = useState("");

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroupForm);
  const [groupFormError, setGroupFormError] = useState("");

  async function load() {
    const [u, g] = await Promise.all([api.adminUsers(), api.adminGroups()]);
    setUsers(u.users);
    setGroups(g.groups);
  }

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    load().catch((e: Error) => setError(e.message));
  }, [user]);

  if (loading) return null;
  if (!user || user.role !== "ADMIN") return <Navigate to="/login" replace />;

  const currentUserId = user.id;

  function openCreateUser() {
    setEditingUser(null);
    setUserForm(emptyUserForm());
    setUserFormError("");
    setUserDialogOpen(true);
  }

  function openEditUser(u: User) {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      name: u.name,
      email: u.email || "",
      password: "",
      role: u.role,
      groupIds: u.groupMembers?.map((m) => m.group.id) ?? [],
    });
    setUserFormError("");
    setUserDialogOpen(true);
  }

  function closeUserDialog() {
    setUserDialogOpen(false);
    setEditingUser(null);
    setUserForm(emptyUserForm());
    setUserFormError("");
  }

  async function onSaveUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setUserFormError("");
    setError("");
    setMessage("");
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          username: userForm.username.trim(),
          name: userForm.name.trim(),
          email: userForm.email.trim() || null,
          role: userForm.role,
          groupIds: userForm.groupIds,
          ...(userForm.password.trim()
            ? { password: userForm.password.trim() }
            : {}),
        });
        setMessage("User updated.");
      } else {
        await api.createUser({
          username: userForm.username.trim(),
          name: userForm.name.trim(),
          email: userForm.email.trim() || undefined,
          password: userForm.password.trim(),
          role: userForm.role,
          groupIds: userForm.groupIds,
        });
        setMessage("User created.");
      }
      closeUserDialog();
      await load();
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteUser(u: User) {
    if (u.id === currentUserId) {
      setError("You cannot delete your own account.");
      return;
    }
    const ok = window.confirm(`Delete user “${u.name}” (@${u.username})?`);
    if (!ok) return;
    setError("");
    setMessage("");
    try {
      await api.deleteUser(u.id);
      setMessage("User deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm());
    setGroupFormError("");
    setGroupDialogOpen(true);
  }

  function openEditGroup(g: Group) {
    setEditingGroup(g);
    setGroupForm({
      name: g.name,
      description: g.description || "",
      memberIds: g.members?.map((m) => m.user.id) ?? [],
    });
    setGroupFormError("");
    setGroupDialogOpen(true);
  }

  function closeGroupDialog() {
    setGroupDialogOpen(false);
    setEditingGroup(null);
    setGroupForm(emptyGroupForm());
    setGroupFormError("");
  }

  async function onSaveGroup(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setGroupFormError("");
    setError("");
    setMessage("");
    try {
      if (editingGroup) {
        await api.updateGroup(editingGroup.id, {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
          memberIds: groupForm.memberIds,
        });
        setMessage("Group updated.");
      } else {
        await api.createGroup({
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || undefined,
          memberIds: groupForm.memberIds,
        });
        setMessage("Group created.");
      }
      closeGroupDialog();
      await load();
    } catch (err) {
      setGroupFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteGroup(g: Group) {
    const ok = window.confirm(
      `Delete group “${g.name}”? Members stay as users; only the group is removed.`
    );
    if (!ok) return;
    setError("");
    setMessage("");
    try {
      await api.deleteGroup(g.id);
      setMessage("Group deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function toggleUserGroup(groupId: string) {
    setUserForm((f) => ({
      ...f,
      groupIds: f.groupIds.includes(groupId)
        ? f.groupIds.filter((id) => id !== groupId)
        : [...f.groupIds, groupId],
    }));
  }

  function toggleGroupMember(userId: string) {
    setGroupForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(userId)
        ? f.memberIds.filter((id) => id !== userId)
        : [...f.memberIds, userId],
    }));
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Users & groups</h1>
          <p className="mt-2 text-muted-foreground">
            Manage accounts, roles, and membership groups (admin only).
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={openCreateGroup}>
            <Plus className="h-4 w-4" />
            New group
          </Button>
          <Button type="button" onClick={openCreateUser}>
            <Plus className="h-4 w-4" />
            New user
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{u.name}</p>
                    <Badge>{u.role}</Badge>
                    {u.id === currentUserId && <Badge>You</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username}
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                  {!!u.groupMembers?.length && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Groups: {u.groupMembers.map((m) => m.group.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    title="Edit user"
                    onClick={() => openEditUser(u)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    title="Delete user"
                    disabled={u.id === currentUserId}
                    onClick={() => onDeleteUser(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {!users.length && (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Groups ({groups.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="rounded-md border border-border px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{g.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {g.description || "No description"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {g._count.members} member{g._count.members === 1 ? "" : "s"}
                      {g.members?.length
                        ? `: ${g.members.map((m) => m.user.name).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit group"
                      onClick={() => openEditGroup(g)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      title="Delete group"
                      onClick={() => onDeleteGroup(g)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!groups.length && (
              <p className="text-sm text-muted-foreground">No groups yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={userDialogOpen}
        onClose={closeUserDialog}
        title={editingUser ? "Edit user" : "Create user"}
        description="Set account details, role, and group membership."
      >
        <form className="space-y-4" onSubmit={onSaveUser}>
          <div className="space-y-2">
            <Label htmlFor="user-username">Username</Label>
            <Input
              id="user-username"
              value={userForm.username}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, username: e.target.value }))
              }
              required
              minLength={3}
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers, and underscores only"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={userForm.name}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email (optional)</Label>
            <Input
              id="user-email"
              type="email"
              value={userForm.email}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">
              Password{editingUser ? " (leave blank to keep)" : ""}
            </Label>
            <Input
              id="user-password"
              type="password"
              value={userForm.password}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, password: e.target.value }))
              }
              required={!editingUser}
              minLength={editingUser ? undefined : 6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Role</Label>
            <select
              id="user-role"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={userForm.role}
              onChange={(e) =>
                setUserForm((f) => ({ ...f, role: e.target.value as Role }))
              }
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Groups</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={userForm.groupIds.includes(g.id)}
                    onChange={() => toggleUserGroup(g.id)}
                  />
                  {g.name}
                </label>
              ))}
              {!groups.length && (
                <p className="text-xs text-muted-foreground">No groups yet.</p>
              )}
            </div>
          </div>
          {userFormError && (
            <p className="text-sm text-destructive">{userFormError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeUserDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : editingUser
                  ? "Save user"
                  : "Create user"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={groupDialogOpen}
        onClose={closeGroupDialog}
        title={editingGroup ? "Edit group" : "Create group"}
        description="Groups can be used for space and page permissions."
      >
        <form className="space-y-4" onSubmit={onSaveGroup}>
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={groupForm.name}
              onChange={(e) =>
                setGroupForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              className="min-h-[80px]"
              value={groupForm.description}
              onChange={(e) =>
                setGroupForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={groupForm.memberIds.includes(u.id)}
                    onChange={() => toggleGroupMember(u.id)}
                  />
                  <span>
                    {u.name}{" "}
                    <span className="text-muted-foreground">(@{u.username})</span>
                  </span>
                </label>
              ))}
              {!users.length && (
                <p className="text-xs text-muted-foreground">No users yet.</p>
              )}
            </div>
          </div>
          {groupFormError && (
            <p className="text-sm text-destructive">{groupFormError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeGroupDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : editingGroup
                  ? "Save group"
                  : "Create group"}
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
