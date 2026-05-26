export interface Role {
  id: string;
  name: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
  show_reading_tracker: boolean;
  show_assignment_tracker: boolean;
}

export interface Position {
  id: string;
  title: string;
  color_code: string;
  owner_organization_id: string | null;
  owner_user_id: string | null;
  daily_hours_goal: number | null;
  weekly_hours_goal: number | null;
  monthly_hours_goal: number | null;
  created_at: string;
}

export interface TaskEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  color_code: string | null;
  
  scheduled_start_time: string;
  scheduled_end_time: string;
  
  actual_start_time: string | null;
  actual_end_time: string | null;
  
  is_all_day: boolean;
  show_on_calendar: boolean;
  show_on_task_list: boolean;
  task_list_orders: Record<string, number> | null;
  is_completed: boolean;
  
  position_id: string | null;
  assigned_to: string | null;

  owner_organization_id: string | null;
  owner_user_id: string | null;
  
  created_at: string;
  updated_at: string;
  
  hide_details_in_share: boolean;
  recurrence_group_id: string | null;
}

export interface SharedSchedule {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  payload: any;
}

export interface TrackerItem {
  id: string;
  type: 'reading' | 'assignment';
  title: string;
  description: string | null;
  progress: number;
  total: number;
  due_date: string | null;
  color_code: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}
