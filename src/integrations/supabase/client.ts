import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pfqqflabbexkoagccred.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmcXFmbGFiYmV4a29hZ2NjcmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjI5MjAsImV4cCI6MjA3OTkzODkyMH0.zy35mLXYx5O2jchiVdOrvGj8siagnjxSWvGs8taG37Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);