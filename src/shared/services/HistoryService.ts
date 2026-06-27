import {MMKV} from 'react-native-mmkv';
import {HistoryItem} from '../../app/navigation/types';

const storage = new MMKV({id: 'history-storage'});
const HISTORY_KEY = 'compression_history';
const MAX_HISTORY = 1000;

class HistoryServiceClass {
  getAll(): HistoryItem[] {
    try {
      const raw = storage.getString(HISTORY_KEY);
      if (!raw) {return [];}
      const items = JSON.parse(raw) as HistoryItem[];
      return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  add(item: HistoryItem): void {
    const items = this.getAll();
    const updated = [item, ...items].slice(0, MAX_HISTORY);
    storage.set(HISTORY_KEY, JSON.stringify(updated));
  }

  addBatch(items: HistoryItem[]): void {
    const existing = this.getAll();
    const updated = [...items, ...existing].slice(0, MAX_HISTORY);
    storage.set(HISTORY_KEY, JSON.stringify(updated));
  }

  getById(id: string): HistoryItem | null {
    return this.getAll().find(item => item.id === id) ?? null;
  }

  delete(id: string): void {
    const items = this.getAll().filter(item => item.id !== id);
    storage.set(HISTORY_KEY, JSON.stringify(items));
  }

  clearAll(): void {
    storage.delete(HISTORY_KEY);
  }

  getTotalSaved(): number {
    return this.getAll().reduce((sum, item) => sum + item.savedBytes, 0);
  }

  getRecentItems(limit = 10): HistoryItem[] {
    return this.getAll().slice(0, limit);
  }

  getByType(type: 'image' | 'video'): HistoryItem[] {
    return this.getAll().filter(item => item.type === type);
  }
}

export const HistoryService = new HistoryServiceClass();
