import { Note } from './note.model';

const notes: Note[] = [];

export const NoteRepo = {
  findAll: () => notes,

  findById: (id: string) => notes.find((n) => n.id === id),

  create: (title: string, content: string): Note => {
    const note: Note = {
      id: String(notes.length + 1),
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.push(note);
    return note;
  },

  update: (id: string, title: string, content: string): Note | null => {
    const note = notes.find((n) => n.id === id);
    if (!note) return null;
    if (title) note.title = title;
    if (content) note.content = content;
    note.updatedAt = new Date().toISOString();
    return note;
  },

  delete: (id: string): boolean => {
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) return false;
    notes.splice(index, 1);
    return true;
  },
};
