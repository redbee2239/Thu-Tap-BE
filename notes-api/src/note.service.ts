import { NoteRepo } from './note.repo';

export const NoteService = {
  getAll: () => NoteRepo.findAll(),

  getById: (id: string) => {
    const note = NoteRepo.findById(id);
    if (!note) throw { status: 404, message: 'Note not found' };
    return note;
  },

  create: (title: string, content: string) => {
    if (!title || !content) throw { status: 400, message: 'Title and content are required' };
    return NoteRepo.create(title, content);
  },

  update: (id: string, title: string, content: string) => {
    const note = NoteRepo.update(id, title, content);
    if (!note) throw { status: 404, message: 'Note not found' };
    return note;
  },

  delete: (id: string) => {
    const ok = NoteRepo.delete(id);
    if (!ok) throw { status: 404, message: 'Note not found' };
  },
};
