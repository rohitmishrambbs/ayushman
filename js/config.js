/**
 * ============================================================================
 * Configuration & Supabase Client Initialization
 * ============================================================================
 */

const SUPABASE_URL = 'https://orpzcqljdpptnxibkiyl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3M6CB2Xyc63k_vA6rjOD_A_cRGcrdB8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const pageSize = 40;
