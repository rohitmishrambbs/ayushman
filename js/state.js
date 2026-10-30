/**
 * ============================================================================
 * Centralized Application State
 * ============================================================================
 */

let currentSession = null;
let currentLoadedRecords = [];
let currentTotalCount = 0;
let cachedLeaderboard = [];
let cachedDailyProgress = [];
let cachedCopiedReport = { gpRows: [], familyRows: [], blockScope: 'ALL' };
let currentDailyReportDate = '';
let currentPage = 1;
let pendingTraceableTarget = null;
let pendingAddFamilyContext = null; // { family_id, block_name, gp_name, mobile_no }
