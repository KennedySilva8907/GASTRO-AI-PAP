import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

describe('V3 foundation configuration', () => {
  it('documents the Supabase and Stripe environment variables', () => {
    const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');

    [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_ISSUER',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRO_PRICE_ID',
      'STRIPE_SUCCESS_URL',
      'STRIPE_CANCEL_URL',
    ].forEach((name) => {
      expect(envExample).toContain(`${name}=`);
    });
  });

  it('creates the Supabase schema with RLS for V3 accounts, billing, and usage', () => {
    const migrationPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20260504230000_v3_auth_billing_usage.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('create table if not exists public.profiles');
    expect(sql).toContain('create table if not exists public.subscriptions');
    expect(sql).toContain('create table if not exists public.usage_events');
    expect(sql).toContain('create table if not exists public.daily_usage');
    expect(sql).toContain('alter table public.profiles enable row level security');
    expect(sql).toContain('alter table public.subscriptions enable row level security');
    expect(sql).toContain('alter table public.usage_events enable row level security');
    expect(sql).toContain('alter table public.daily_usage enable row level security');
    expect(sql).toContain('window_started_at');
    expect(sql).toContain('window_expires_at');
    expect(sql).toContain('unique (user_id, feature)');
  });
});
