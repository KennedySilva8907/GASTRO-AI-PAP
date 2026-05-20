-- ============================================================
-- Avatars bucket — public read, namespaced write via RLS.
--
-- Why these policies matter:
--   * Without the folder check, any authenticated user could PUT a file
--     into another user's path (e.g. overwrite a celebrity admin avatar).
--   * The path convention from src/auth/account.js is
--     `${session.user.id}/avatar-${Date.now()}.jpg`, so the first folder
--     segment IS the owner. We enforce that on the server.
--
-- This migration is idempotent: re-running it updates the bucket config
-- and replaces existing avatar policies with the same names.
-- ============================================================

-- 1) Ensure the bucket exists with the right configuration.
--    file_size_limit and allowed_mime_types provide a defense-in-depth
--    layer in case the client whitelist is bypassed.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'avatars',
  'avatars',
  true,                                    -- public read (avatars are not secrets)
  2 * 1024 * 1024,                         -- 2 MB hard cap per object
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Drop any prior versions of our policies before recreating them,
--    so this migration can be re-run safely.
drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_owner_insert" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;
drop policy if exists "avatars_owner_delete" on storage.objects;

-- 3) Anyone (including anon) can READ avatars — they are public images.
create policy "avatars_public_read"
on storage.objects
for select
using (bucket_id = 'avatars');

-- 4) Authenticated users can INSERT only into their own folder
--    (path must start with their auth.uid()).
create policy "avatars_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 5) Same restriction on UPDATE — needed because the client uses
--    upsert: true, which translates to UPDATE on existing objects.
create policy "avatars_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 6) DELETE only the user's own avatar (e.g. account deletion flow).
create policy "avatars_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
