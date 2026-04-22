const SUPABASE_URL = 'https://mugunkyfvdpwiedjqgil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Z3Vua3lmdmRwd2llZGpxZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTgxOTksImV4cCI6MjA5MjM3NDE5OX0.gPQIjnuzbSb72nTvKbL4VwWw3TkhjzZuMJz-s4SdUn0';

async function run() {
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/users?limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const data = await res2.json();
  console.log('Users schema:', data);
}
run();
