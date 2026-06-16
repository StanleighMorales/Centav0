import type { Category, CategoryType, CreateCategoryInput, UpdateCategoryInput } from '../domain/types';

export interface ICategoryRepository {
  list(type?: CategoryType): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  softDelete(id: string): Promise<void>;
}
