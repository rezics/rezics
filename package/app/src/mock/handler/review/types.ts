// 领域模型（只放数据结构，不放行为）
export type Id = string;

export interface User {
  id: Id;
  name: string;
  avatar: string;
}

export interface ReviewRow {
  id: Id;
  bookId: Id;
  content: string;
  rating: number; // 0-5
  created_at: string; // ISO
  userId: Id;
}

export interface Review extends Omit<ReviewRow, 'userId'> {
  user: User;
}

export interface Quote {
  id: Id;
  bookId?: Id;
  content: string;
  author?: any;
}
