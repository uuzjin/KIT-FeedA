-- ============================================================
-- FeedA — Supabase Storage 버킷 설정
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 버킷 생성
insert into storage.buckets (id, name, public)
values
    ('scripts', 'scripts', false),
    ('audios',  'audios',  false),
    ('profiles','profiles', false)
on conflict (id) do nothing;

-- scripts 버킷 정책: 담당 강사만 업로드/삭제, 관련자 다운로드
create policy "scripts: 강사 업로드" on storage.objects
    for insert with check (
        bucket_id = 'scripts'
        and auth.role() = 'authenticated'
    );

create policy "scripts: 관련자 다운로드" on storage.objects
    for select using (
        bucket_id = 'scripts'
        and auth.role() = 'authenticated'
    );

create policy "scripts: 강사 삭제" on storage.objects
    for delete using (
        bucket_id = 'scripts'
        and auth.role() = 'authenticated'
    );

-- audios 버킷 정책
create policy "audios: 강사 업로드" on storage.objects
    for insert with check (
        bucket_id = 'audios'
        and auth.role() = 'authenticated'
    );

create policy "audios: 관련자 다운로드" on storage.objects
    for select using (
        bucket_id = 'audios'
        and auth.role() = 'authenticated'
    );

create policy "audios: 강사 삭제" on storage.objects
    for delete using (
        bucket_id = 'audios'
        and auth.role() = 'authenticated'
    );

-- profiles 버킷 정책
create policy "profiles: 본인 업로드" on storage.objects
    for insert with check (
        bucket_id = 'profiles'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "profiles: 본인 삭제" on storage.objects
    for delete using (
        bucket_id = 'profiles'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "profiles: 인증자 조회" on storage.objects
    for select using (
        bucket_id = 'profiles'
        and auth.role() = 'authenticated'
    );
