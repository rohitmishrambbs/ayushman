/**
 * ============================================================================
 * Centralized Application State
 * ============================================================================
 */

let currentLoadedRecords = [];
let cachedLeaderboard = [];
let currentPage = 1;
let pendingTraceableTarget = null;
let pendingAddFamilyContext = null; // { family_id, block_name, gp_name, mobile_no }
