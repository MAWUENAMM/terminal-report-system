create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  logo_url text,
  phone text,
  email text,
  headteacher_name text,
  district text,
  region text,
  academic_year text not null default '2026/2027',
  current_term smallint not null default 1 check (current_term between 1 and 3),
  sba_weight numeric(5,2) not null default 50,
  exam_weight numeric(5,2) not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists public.school_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('ADMIN','HEADTEACHER','CLASS_TEACHER','SUBJECT_TEACHER')),
  class_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  level text not null check (level in ('KG','PRIMARY','JHS')),
  academic_year text not null,
  class_teacher_id uuid references public.school_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text,
  level text not null default 'ALL' check (level in ('KG','PRIMARY','JHS','ALL')),
  is_core boolean not null default false,
  display_order integer not null default 0
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  other_names text,
  gender text not null check (gender in ('M','F')),
  date_of_birth date,
  photo_url text,
  class_id uuid not null references public.classes(id) on delete restrict,
  guardian_name text,
  guardian_phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','TRANSFERRED','WITHDRAWN')),
  created_at timestamptz not null default now(),
  unique (school_id, admission_number)
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  term smallint not null check (term between 1 and 3),
  academic_year text not null,
  sba_raw numeric(6,2),
  sba_scaled numeric(6,2) not null default 0,
  exam_raw numeric(6,2),
  exam_scaled numeric(6,2) not null default 0,
  total numeric(6,2) not null default 0,
  grade text not null default 'F',
  position integer,
  subject_remark text,
  unique (student_id, subject_id, term, academic_year)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term smallint not null check (term between 1 and 3),
  academic_year text not null,
  days_present integer not null default 0,
  total_days integer not null default 0,
  unique (student_id, term, academic_year)
);

create table if not exists public.affective_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term smallint not null check (term between 1 and 3),
  academic_year text not null,
  conduct text,
  interest text,
  attitude text,
  talents text,
  unique (student_id, term, academic_year)
);

create table if not exists public.remarks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term smallint not null check (term between 1 and 3),
  academic_year text not null,
  class_teacher_remark text,
  headteacher_remark text,
  class_teacher_id uuid references public.school_users(id) on delete set null,
  headteacher_id uuid references public.school_users(id) on delete set null,
  unique (student_id, term, academic_year)
);

create index if not exists idx_students_school_class on public.students(school_id, class_id);
create index if not exists idx_scores_school_term on public.scores(school_id, academic_year, term);
create index if not exists idx_scores_student on public.scores(student_id);

alter table public.schools enable row level security;
alter table public.school_users enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.scores enable row level security;
alter table public.attendance enable row level security;
alter table public.affective_records enable row level security;
alter table public.remarks enable row level security;

create or replace function public.current_school_id()
returns uuid
language sql
stable
security invoker
as $$
  select school_id from public.school_users where auth_user_id = auth.uid() limit 1;
$$;

create policy "school users read own school" on public.schools for select to authenticated using (id = public.current_school_id());
create policy "school users manage own school" on public.schools for update to authenticated using (id = public.current_school_id()) with check (id = public.current_school_id());

create policy "users read own school" on public.school_users for select to authenticated using (school_id = public.current_school_id());
create policy "classes own school" on public.classes for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());
create policy "subjects own school" on public.subjects for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());
create policy "students own school" on public.students for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());
create policy "scores own school" on public.scores for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());
create policy "attendance own school" on public.attendance for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());
create policy "affective own school" on public.affective_records for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());
create policy "remarks own school" on public.remarks for all to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());


