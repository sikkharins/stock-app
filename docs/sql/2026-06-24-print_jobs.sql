-- คิวงานพิมพ์ SO ที่ออฟฟิศ (รันใน Supabase SQL editor)
create table if not exists print_jobs (
  id          bigint generated always as identity primary key,
  doc_num     text not null,
  image_url   text not null,
  status      text not null default 'pending',  -- pending | printing | printed | error | cleared
  created_at  timestamptz not null default now(),
  printed_at  timestamptz,
  created_by  text
);
create index if not exists print_jobs_status_idx on print_jobs (status, created_at);

-- เปิด RLS แบบไม่มี policy = บล็อก anon/authenticated ทั้งหมด
-- (มีแต่ฝั่ง server ที่ใช้ service role ซึ่ง bypass RLS แตะตารางนี้)
alter table print_jobs enable row level security;

-- โปรเจกต์นี้ไม่ได้ auto-grant ตารางใหม่ให้ service_role ต้อง grant เอง
-- ไม่งั้น API ฝั่ง server จะเจอ "permission denied for table print_jobs"
grant all on table print_jobs to service_role;
