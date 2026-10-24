import { KeepNoteItem } from '../types/music';
import { getAccessToken } from './auth';

export interface KeepSyncResult {
  notes: KeepNoteItem[];
  cloudStatus: 'synced' | 'enterprise-restricted' | 'unauthenticated';
  statusMessage?: string;
}

interface RawKeepNote {
  name?: string;
  title?: string;
  body?: {
    text?: {
      text?: string;
    };
  };
  updateTime?: string;
  createTime?: string;
}

export async function listGoogleKeepNotes(
  existingNotes: KeepNoteItem[]
): Promise<KeepSyncResult> {
  const token = await getAccessToken();
  if (!token) {
    return {
      notes: existingNotes,
      cloudStatus: 'unauthenticated',
    };
  }

  const res = await fetch('/api/keep/notes', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const apiMessage =
      data?.error?.message ||
      data?.error ||
      'Google Keep REST API requires a Google Workspace Enterprise domain account.';
    return {
      notes: existingNotes,
      cloudStatus: 'enterprise-restricted',
      statusMessage: apiMessage,
    };
  }

  const rawNotes: RawKeepNote[] = Array.isArray(data.notes) ? data.notes : [];
  const cloudNotes: KeepNoteItem[] = rawNotes.map((n, idx) => ({
    id: n.name || `keep-cloud-${idx}-${Date.now()}`,
    name: n.name,
    title: n.title || 'Untitled Keep Note',
    body: n.body?.text?.text || '',
    updatedAt: n.updateTime || n.createTime || new Date().toISOString(),
    syncedWithCloud: true,
  }));

  // Merge cloud notes with unsynced session notes
  const unsynced = existingNotes.filter((item) => !item.syncedWithCloud);
  return {
    notes: [...cloudNotes, ...unsynced],
    cloudStatus: 'synced',
  };
}

export async function createGoogleKeepNote(
  title: string,
  body: string,
  moodHint?: string,
  linkedTrackTitle?: string
): Promise<{ note: KeepNoteItem; cloudSynced: boolean; apiNotice?: string }> {
  const token = await getAccessToken();

  if (token) {
    const res = await fetch('/api/keep/notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, bodyText: body }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.name) {
      return {
        note: {
          id: data.name,
          name: data.name,
          title: data.title || title,
          body: data.body?.text?.text || body,
          updatedAt: data.updateTime || new Date().toISOString(),
          moodHint,
          linkedTrackTitle,
          syncedWithCloud: true,
        },
        cloudSynced: true,
      };
    }

    const errMsg =
      data?.error?.message ||
      'Saved in AuraTune Keep workspace (Google Keep REST endpoint requires Workspace Enterprise delegation for cloud write).';
    return {
      note: {
        id: `keep-${Date.now()}`,
        title,
        body,
        updatedAt: new Date().toISOString(),
        moodHint,
        linkedTrackTitle,
        syncedWithCloud: false,
      },
      cloudSynced: false,
      apiNotice: errMsg,
    };
  }

  return {
    note: {
      id: `keep-${Date.now()}`,
      title,
      body,
      updatedAt: new Date().toISOString(),
      moodHint,
      linkedTrackTitle,
      syncedWithCloud: false,
    },
    cloudSynced: false,
  };
}

export async function deleteGoogleKeepNote(
  note: KeepNoteItem
): Promise<{ deletedFromCloud: boolean }> {
  const token = await getAccessToken();
  if (token && note.syncedWithCloud && note.name) {
    const res = await fetch(`/api/keep/notes/${encodeURIComponent(note.name)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return { deletedFromCloud: res.ok };
  }
  return { deletedFromCloud: false };
}
