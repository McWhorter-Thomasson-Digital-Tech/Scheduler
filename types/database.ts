export type Role = 'business' | 'employee' | 'individual';

export interface Position {
  id: string;
  title: string;
  color_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  position_id: string | null;
  created_at: string;
}

export interface TaskEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  
  scheduled_start_time: string;
  scheduled_end_time: string;
  
  actual_start_time: string | null;
  actual_end_time: string | null;
  
  position_id: string | null;
  assigned_to: string | null;
  
  created_at: string;
  updated_at: string;
}
