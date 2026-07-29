-- Optional seed data for local development / a fresh Supabase project.
-- Mirrors the venues that used to be hard-coded for Test Mode in src/lib/mock-data.ts.

insert into public.venues (id, name, city, county, latitude, longitude) values
  ('venue-test-001', 'Test Venue (for Check-in)', 'Test City', 'Test County', 0, 0),
  ('venue-nrb-001', 'Sarova Stanley', 'Nairobi', 'Nairobi', -1.2833, 36.8219),
  ('venue-nrb-002', 'Villa Rosa Kempinski', 'Nairobi', 'Nairobi', -1.2721, 36.8095),
  ('venue-msa-001', 'Serena Beach Resort & Spa', 'Mombasa', 'Mombasa', -4.0435, 39.6682),
  ('venue-ksm-001', 'Acacia Premier Hotel', 'Kisumu', 'Kisumu', -0.1022, 34.7575)
on conflict (id) do nothing;
