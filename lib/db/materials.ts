import { db } from './database';
import { nanoid } from 'nanoid';
import type { MaterialRecord } from '@/lib/types/material';

export async function addMaterial(
  material: Omit<MaterialRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const id = nanoid();
  await db.materials.add({
    ...material,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function getAllMaterials() {
  return db.materials.orderBy('createdAt').reverse().toArray();
}

export async function getMaterial(id: string) {
  return db.materials.get(id);
}

export async function updateMaterial(id: string, updates: Partial<MaterialRecord>) {
  await db.materials.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteMaterial(id: string) {
  await db.materials.delete(id);
}
