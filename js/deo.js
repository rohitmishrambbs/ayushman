/**
 * ============================================================================
 * Block DEO Terminal - Data Fetching & Status Mutations
 * ============================================================================
 */

const DEO_CARD_COLUMNS = 'family_id, member_id, block_name, gram_panchayat_name, member_name, father_name, type, gender, date_of_birth, birth_year, mobile_no, STATUS, remark';

async function getCoveredFamilyIds(block, gp) {
    const key = `${block || 'ALL'}__${gp || 'ALL'}`;
    if (typeof coveredFamilyIdsCache !== 'undefined' && coveredFamilyIdsCache && coveredFamilyIdsCache.has(key)) {
        return coveredFamilyIdsCache.get(key);
    }

    try {
        let q = supabaseClient
            .from('bocw_members')
            .select('family_id')
            .eq('STATUS', 'Approved');

        if (block && block !== 'ALL') {
            q = q.eq('block_name', block);
        }
        if (gp && gp !== 'ALL' && block !== 'ALL') {
            q = q.eq('gram_panchayat_name', gp);
        }

        const { data, error } = await q.limit(10000);
        if (error || !Array.isArray(data)) {
            return new Set();
        }

        const set = new Set();
        data.forEach(r => {
            if (r.family_id) set.add(String(r.family_id));
        });

        if (typeof coveredFamilyIdsCache !== 'undefined' && coveredFamilyIdsCache) {
            coveredFamilyIdsCache.set(key, set);
        }
        return set;
    } catch (e) {
        console.warn('Error fetching covered family IDs:', e);
        return new Set();
    }
}


async function fetchBlockGpsData(block, forceRefresh = false) {
    if (!forceRefresh && gpCacheByBlock && gpCacheByBlock.has(block)) {
        return gpCacheByBlock.get(block);
    }

    const [rpcRes, membersRes] = await Promise.all([
        supabaseClient.rpc('get_block_gps', { p_block: block }),
        supabaseClient
            .from('bocw_members')
            .select('gram_panchayat_name, family_id, member_id, STATUS, updated_at')
            .eq('block_name', block)
            .limit(10000)
    ]);

    if (rpcRes.error) throw rpcRes.error;
    const data = rpcRes.data || [];

    // Compute per-GP status breakdown, unique family counts & latest processing date
    const gpStatsMap = new Map();
    const blockFamiliesSet = new Set();
    const blockApprovedFamiliesSet = new Set();

    if (membersRes && membersRes.data) {
        membersRes.data.forEach(r => {
            const famId = r.family_id ? String(r.family_id) : null;
            if (famId) blockFamiliesSet.add(famId);

            const st = cleanStatus(r.STATUS);
            if (st === 'Approved' && famId) {
                blockApprovedFamiliesSet.add(famId);
            }

            const gp = String(r.gram_panchayat_name ?? '').trim();
            if (!gp) return;
            if (!gpStatsMap.has(gp)) {
                gpStatsMap.set(gp, {
                    total_members: 0,
                    families: new Set(),
                    approved_families: new Set(),
                    approved_members: 0,
                    pending_members: 0,
                    not_applied_members: 0,
                    no_record_members: 0,
                    not_traceable_members: 0,
                    extra_added_members: 0,
                    processed_members: 0,
                    latest_timestamp: null
                });
            }
            const stObj = gpStatsMap.get(gp);
            stObj.total_members++;
            if (famId) stObj.families.add(famId);
            if (st === 'Approved' && famId) {
                stObj.approved_families.add(famId);
            }
            if (String(r.member_id ?? '').startsWith('EXTRA_')) {
                stObj.extra_added_members++;
            }

            const isProcessed = st !== 'Not Applied';
            if (st === 'Approved') {
                stObj.approved_members++;
                stObj.processed_members++;
            } else if (st === 'Portal Pending') {
                stObj.pending_members++;
                stObj.processed_members++;
            } else if (st === 'No Record Found') {
                stObj.no_record_members++;
                stObj.processed_members++;
            } else if (st === 'Not Traceable') {
                stObj.not_traceable_members++;
                stObj.processed_members++;
            } else {
                stObj.not_applied_members++;
            }

            if (isProcessed && r.updated_at) {
                if (!stObj.latest_timestamp || r.updated_at > stObj.latest_timestamp) {
                    stObj.latest_timestamp = r.updated_at;
                }
            }
        });
    }

    data.forEach(gp => {
        const gpName = String(gp.gram_panchayat_name ?? '').trim();
        const stObj = gpStatsMap.get(gpName);
        if (stObj) {
            gp.total_members = Number(gp.total_members || stObj.total_members);
            gp.total_families = stObj.families.size;
            gp.uncovered_families = Math.max(0, stObj.families.size - stObj.approved_families.size);
            gp.approved_members = stObj.approved_members;
            gp.pending_members = stObj.pending_members;
            gp.not_applied_members = stObj.not_applied_members;
            gp.unidentified_members = 0;
            gp.no_record_members = stObj.no_record_members;
            gp.not_traceable_members = stObj.not_traceable_members;
            gp.extra_added_members = stObj.extra_added_members;
            gp.processed_members = stObj.processed_members;
            gp.latest_timestamp = stObj.latest_timestamp;
        } else {
            const fallbackApp = Number(gp.approved_members || 0);
            const fallbackTot = Number(gp.total_members || 0);
            gp.total_families = Number(gp.total_families || 0);
            gp.uncovered_families = Math.max(0, gp.total_families - (fallbackApp > 0 ? 1 : 0));
            gp.approved_members = fallbackApp;
            gp.pending_members = 0;
            gp.not_applied_members = Math.max(0, fallbackTot - fallbackApp);
            gp.unidentified_members = 0;
            gp.no_record_members = 0;
            gp.not_traceable_members = 0;
            gp.extra_added_members = 0;
            gp.processed_members = fallbackApp;
            gp.latest_timestamp = null;
        }
    });

    data.block_uncovered_families = Math.max(0, blockFamiliesSet.size - blockApprovedFamiliesSet.size);
    data.block_total_families = blockFamiliesSet.size;
    data.block_approved_families = blockApprovedFamiliesSet.size;

    if (gpCacheByBlock) gpCacheByBlock.set(block, data);
    return data;
}

async function loadGPDropdown(preserveSelection = false, forceRefresh = false) {
    const block = getAuthorizedBlock();
    if (!block) return;
    const gpSelect = document.getElementById('gpSelector');
    if (!gpSelect) return;

    const previousValue = preserveSelection ? gpSelect.value : 'ALL';

    if (block === 'ALL') {
        gpSelect.innerHTML = `<option value="ALL">Select Gram Panchayat</option>`;
        return;
    }

    // Reuse in-memory cache to eliminate repetitive RPC calls
    if (!forceRefresh && gpCacheByBlock && gpCacheByBlock.has(block)) {
        const cachedData = gpCacheByBlock.get(block);
        renderGPOptions(gpSelect, block, cachedData, preserveSelection, previousValue);
        return;
    }

    if (!preserveSelection) {
        gpSelect.innerHTML = `<option value="ALL">Loading GPs for ${block}...</option>`;
    }

    try {
        const data = await fetchBlockGpsData(block, forceRefresh);
        renderGPOptions(gpSelect, block, data, preserveSelection, previousValue);
    } catch (err) {
        if (!preserveSelection) {
            gpSelect.innerHTML = `<option value="ALL">Select Gram Panchayat</option>`;
        }
    }
}

function renderGPOptions(gpSelect, block, data, preserveSelection, previousValue) {
    gpSelect.innerHTML = `<option value="ALL">Select Gram Panchayat</option>`;
    if (data && data.length > 0) {
        data.forEach(gp => {
            const gpName = String(gp.gram_panchayat_name ?? '');
            const count = Number(gp.processed_members ?? gp.approved_members ?? 0);
            const total = Number(gp.total_members ?? 0);
            const opt = document.createElement('option');
            opt.value = gpName;
            opt.innerText = formatGPOptionText(gpName, count, total, gp.latest_timestamp);
            gpSelect.appendChild(opt);
        });
    }

    if (preserveSelection && previousValue) {
        const exists = Array.from(gpSelect.options).some(o => o.value === previousValue);
        gpSelect.value = exists ? previousValue : 'ALL';
    }
}

function renderSkeletonLoader() {
    return `
        <div class="p-6 space-y-4 animate-pulse">
            <div class="h-6 skeleton-box w-1/3"></div>
            <div class="space-y-3">
                <div class="h-16 skeleton-box w-full"></div>
                <div class="h-16 skeleton-box w-full"></div>
                <div class="h-16 skeleton-box w-full"></div>
            </div>
        </div>
    `;
}

async function loadBlockData() {
    const block = getAuthorizedBlock();
    if (!block) return;

    const displayBlockTitle = block === 'ALL' ? 'ALL 22 BLOCKS (District-Wide)' : block;
    const titleEl = document.getElementById('activeBlockTitle');
    if (titleEl) titleEl.innerText = `${displayBlockTitle} Block Terminal`;

    const gp = document.getElementById('gpSelector').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.trim();
    const container = document.getElementById('familyListContainer');
    const statusText = document.getElementById('syncStatusText');

    try {
        if (statusText) statusText.innerText = "Fetching Cloud Data...";
        container.innerHTML = renderSkeletonLoader();

        // Fingerprint check: only run expensive count: 'exact' when filters change
        const currentFingerprint = `${block}__${gp}__${statusFilter}__${searchQuery}`;
        const needsCount = (currentFingerprint !== lastFilterFingerprint) || (currentTotalCount === null);

        let query = supabaseClient
            .from('bocw_members')
            .select(DEO_CARD_COLUMNS, needsCount ? { count: 'exact' } : {});

        if (block !== 'ALL') {
            query = query.eq('block_name', block);
        }

        if (gp !== 'ALL' && block !== 'ALL') {
            query = query.eq('gram_panchayat_name', gp);
        }

        const isUncoveredFamilyFilter = (statusFilter === 'UNCOVERED_FAMILY');
        let currentCoveredFamSet = null;

        if (isUncoveredFamilyFilter) {
            currentCoveredFamSet = await getCoveredFamilyIds(block, gp);
            const coveredFamIds = Array.from(currentCoveredFamSet);

            if (coveredFamIds.length > 0 && coveredFamIds.length <= 450) {
                query = query.not('family_id', 'in', `(${coveredFamIds.join(',')})`);
            } else if (coveredFamIds.length > 450) {
                query = query.or('STATUS.is.null,STATUS.neq.Approved');
            }
        } else if (statusFilter !== 'ALL') {
            if (statusFilter === 'EXTRA_ONLY') {
                query = query.ilike('member_id', 'EXTRA_%');
            } else if (statusFilter === 'Not Applied') {
                query = query.or('STATUS.is.null,STATUS.eq.Not Applied,STATUS.eq.Unidentified,STATUS.eq.NULL,STATUS.eq.');
            } else {
                query = query.eq('STATUS', statusFilter);
            }
        }

        if (searchQuery.length > 0) {
            const q = searchQuery.replace(/[,()]/g, ' ').trim();
            query = query.or(`member_name.ilike.%${q}%,family_id.ilike.%${q}%,member_id.ilike.%${q}%,mobile_no.ilike.%${q}%,father_name.ilike.%${q}%`);
        }

        const fromIdx = (currentPage - 1) * pageSize;
        const toIdx = fromIdx + pageSize - 1;

        const { data, count, error } = await query
            .order('family_id', { ascending: true })
            .order('member_id', { ascending: true })
            .range(fromIdx, toIdx);

        if (error) throw error;

        currentLoadedRecords = data || [];
        if (needsCount) {
            currentTotalCount = count || 0;
            lastFilterFingerprint = currentFingerprint;
        }

        renderFamilyGroups(currentLoadedRecords, currentTotalCount, currentCoveredFamSet);
        updatePaginationControls(currentTotalCount);
        updateBlockSummaryBar(block);
        statusText.innerText = "✓ Synced with Cloud DB";
    } catch (err) {
        console.error("Database fetch error:", err);
        container.innerHTML = `<div class="p-8 text-center text-rose-600 text-sm font-bold">Database Query Error: ${err.message}</div>`;
        statusText.innerText = "Query Error";
        showToast(`Query Error: ${err.message}`, 'error');
    }
}

function quickFilterStatus(statusVal) {
    const statusSelect = document.getElementById('statusFilter');
    if (!statusSelect) return;
    statusSelect.value = statusVal;
    resetPageAndLoad();
    const filterLabel = statusVal === 'ALL' ? 'All Statuses' : (statusVal === 'UNCOVERED_FAMILY' ? 'Uncovered Family' : statusVal);
    showToast(`Filtering by: ${filterLabel}`, 'info', 2000);
}

function applyLocalStatusDelta(block, oldStatus, newStatus, delta = 1) {
    if (!cachedLeaderboard || cachedLeaderboard.length === 0) return;
    const cleanOld = cleanStatus(oldStatus);
    const cleanNew = cleanStatus(newStatus);
    if (cleanOld === cleanNew) return;

    const mapStatusToField = (st) => {
        if (st === 'Approved') return 'approved_members';
        if (st === 'Portal Pending') return 'pending_members';
        if (st === 'No Record Found') return 'no_record_members';
        if (st === 'Not Traceable') return 'not_traceable_members';
        return 'not_applied_members';
    };

    const oldField = mapStatusToField(cleanOld);
    const newField = mapStatusToField(cleanNew);

    const targetRow = cachedLeaderboard.find(r => r.block_name === block);
    if (targetRow) {
        targetRow[oldField] = Math.max(0, Number(targetRow[oldField] || 0) - delta);
        targetRow[newField] = Number(targetRow[newField] || 0) + delta;
    }
}

function applyLocalGpApprovalDelta(block, gpName, oldStatus, newStatus, delta = 1) {
    if (!gpCacheByBlock || !gpCacheByBlock.has(block) || !gpName) return;
    const cleanOld = cleanStatus(oldStatus);
    const cleanNew = cleanStatus(newStatus);
    if (cleanOld === cleanNew) return;

    const mapStatusToField = (st) => {
        if (st === 'Approved') return 'approved_members';
        if (st === 'Portal Pending') return 'pending_members';
        if (st === 'No Record Found') return 'no_record_members';
        if (st === 'Not Traceable') return 'not_traceable_members';
        return 'not_applied_members';
    };

    const gps = gpCacheByBlock.get(block);
    if (!Array.isArray(gps)) return;
    const gpEntry = gps.find(g => g.gram_panchayat_name === gpName);
    if (gpEntry) {
        const oldField = mapStatusToField(cleanOld);
        const newField = mapStatusToField(cleanNew);
        gpEntry[oldField] = Math.max(0, Number(gpEntry[oldField] || 0) - delta);
        gpEntry[newField] = Number(gpEntry[newField] || 0) + delta;

        const oldProcessed = cleanOld !== 'Not Applied';
        const newProcessed = cleanNew !== 'Not Applied';
        if (oldProcessed && !newProcessed) {
            gpEntry.processed_members = Math.max(0, Number(gpEntry.processed_members ?? 0) - delta);
        } else if (!oldProcessed && newProcessed) {
            gpEntry.processed_members = Number(gpEntry.processed_members ?? 0) + delta;
            gpEntry.latest_timestamp = new Date().toISOString();
        } else if (newProcessed) {
            gpEntry.latest_timestamp = new Date().toISOString();
        }

        const gpSelect = document.getElementById('gpSelector');
        if (gpSelect) {
            const opt = Array.from(gpSelect.options).find(o => o.value === gpName);
            if (opt) {
                const count = Number(gpEntry.processed_members ?? gpEntry.approved_members ?? 0);
                const total = Number(gpEntry.total_members ?? 0);
                opt.innerText = formatGPOptionText(gpName, count, total, gpEntry.latest_timestamp);
            }
        }
    }
}

async function updateBlockSummaryBar(block, forceRefresh = false) {
    const authorizedBlock = getAuthorizedBlock() || block;
    const bar = document.getElementById('blockSummaryBar');
    if (!bar) return;

    const gpSelect = document.getElementById('gpSelector');
    const selectedGp = gpSelect ? gpSelect.value : 'ALL';

    if (authorizedBlock !== 'ALL' && selectedGp && selectedGp !== 'ALL') {
        if (!gpCacheByBlock || !gpCacheByBlock.has(authorizedBlock)) {
            try {
                await fetchBlockGpsData(authorizedBlock);
            } catch (e) {}
        }
        renderSummaryBarFromLeaderboard(authorizedBlock);
        return;
    }

    // Use cached leaderboard if available to eliminate expensive full-district RPC scans
    if (!forceRefresh && cachedLeaderboard && cachedLeaderboard.length > 0) {
        renderSummaryBarFromLeaderboard(authorizedBlock);
        return;
    }

    try {
        const { data, error } = await supabaseClient.rpc('get_block_leaderboard');
        if (error || !data) return;
        cachedLeaderboard = data;
        renderSummaryBarFromLeaderboard(authorizedBlock);
    } catch (e) {
        console.error("Summary bar error:", e);
    }
}

function renderSummaryBarFromLeaderboard(authorizedBlock) {
    const bar = document.getElementById('blockSummaryBar');
    if (!bar) return;

    const gpSelect = document.getElementById('gpSelector');
    const selectedGp = gpSelect ? gpSelect.value : 'ALL';

    let row = null;
    if (authorizedBlock !== 'ALL' && selectedGp && selectedGp !== 'ALL' && gpCacheByBlock && gpCacheByBlock.has(authorizedBlock)) {
        const gps = gpCacheByBlock.get(authorizedBlock);
        if (Array.isArray(gps)) {
            row = gps.find(g => g.gram_panchayat_name === selectedGp) || null;
        }
    }

    if (!row) {
        if (!cachedLeaderboard || cachedLeaderboard.length === 0) return;
        if (authorizedBlock === 'ALL') {
            row = cachedLeaderboard.reduce((acc, r) => {
                acc.total_members += Number(r.total_members || 0);
                acc.total_families += Number(r.total_families || 0);
                acc.approved_members += Number(r.approved_members || 0);
                acc.pending_members += Number(r.pending_members || 0);
                acc.not_applied_members += Number(r.not_applied_members || 0);
                acc.unidentified_members += Number(r.unidentified_members || 0);
                acc.no_record_members += Number(r.no_record_members || 0);
                acc.not_traceable_members += Number(r.not_traceable_members || 0);
                acc.extra_added_members += Number(r.extra_added_members || 0);
                return acc;
            }, {
                total_members: 0,
                total_families: 0,
                approved_members: 0,
                pending_members: 0,
                not_applied_members: 0,
                unidentified_members: 0,
                no_record_members: 0,
                not_traceable_members: 0,
                extra_added_members: 0
            });
        } else {
            row = cachedLeaderboard.find(r => r.block_name === authorizedBlock);
        }
    }

    if (!row) return;

    const notAppliedTotal = Number(row.not_applied_members || 0) + Number(row.unidentified_members || 0);
    const extraTotal = Number(row.extra_added_members || 0);
    const currentFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'ALL';

    let uncoveredFamCount = 0;
    if (authorizedBlock !== 'ALL' && selectedGp && selectedGp !== 'ALL') {
        uncoveredFamCount = (row && row.uncovered_families !== undefined)
            ? row.uncovered_families
            : 0;
    } else if (authorizedBlock !== 'ALL') {
        const gps = gpCacheByBlock && gpCacheByBlock.get(authorizedBlock);
        if (gps && gps.block_uncovered_families !== undefined) {
            uncoveredFamCount = gps.block_uncovered_families;
        } else if (Array.isArray(gps)) {
            uncoveredFamCount = gps.reduce((sum, g) => sum + (g.uncovered_families || 0), 0);
        } else {
            uncoveredFamCount = row.uncovered_families || 0;
        }
    } else {
        // District-Wide (ALL 22 blocks)
        let sumUncovered = 0;
        let hasAny = false;
        if (gpCacheByBlock) {
            gpCacheByBlock.forEach(gps => {
                if (gps && gps.block_uncovered_families !== undefined) {
                    sumUncovered += gps.block_uncovered_families;
                    hasAny = true;
                }
            });
        }
        uncoveredFamCount = hasAny ? sumUncovered : Math.max(0, Number(row.total_families || 0) - Math.round(Number(row.approved_members || 0) / 2.3));
    }

    bar.innerHTML = `
        <div onclick="quickFilterStatus('ALL')" title="Click to show all records" class="summary-stat-box bg-slate-50 px-2.5 py-2 rounded-lg border ${currentFilter === 'ALL' ? 'ring-2 ring-slate-800 border-slate-400' : 'border-slate-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-slate-500 font-bold uppercase text-[9.5px]">Base Total</span>
                <span class="text-[11px] text-slate-400">📋</span>
            </div>
            <div class="mt-0.5 flex items-baseline gap-1">
                <span class="font-black text-slate-900 text-sm font-mono">${Number(row.total_members || 0).toLocaleString()}</span>
                <span class="font-normal text-[10px] text-slate-500">(${Number(row.total_families || 0).toLocaleString()} Fam)</span>
            </div>
        </div>

        <div onclick="quickFilterStatus('Approved')" title="Click to filter Approved" class="summary-stat-box bg-emerald-50/80 px-2.5 py-2 rounded-lg border ${currentFilter === 'Approved' ? 'ring-2 ring-emerald-600 border-emerald-400' : 'border-emerald-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-emerald-800 font-bold uppercase text-[9.5px]">Approved</span>
                <span class="text-[11px] text-emerald-600">✓</span>
            </div>
            <span class="font-black text-emerald-900 text-sm font-mono block mt-0.5">${Number(row.approved_members || 0).toLocaleString()}</span>
        </div>

        <div onclick="quickFilterStatus('Portal Pending')" title="Click to filter Portal Pending" class="summary-stat-box bg-amber-50/80 px-2.5 py-2 rounded-lg border ${currentFilter === 'Portal Pending' ? 'ring-2 ring-amber-600 border-amber-400' : 'border-amber-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-amber-800 font-bold uppercase text-[9.5px]">Portal Pending</span>
                <span class="text-[11px] text-amber-600">⏳</span>
            </div>
            <span class="font-black text-amber-900 text-sm font-mono block mt-0.5">${Number(row.pending_members || 0).toLocaleString()}</span>
        </div>

        <div onclick="quickFilterStatus('Not Applied')" title="Click to filter Not Applied" class="summary-stat-box bg-slate-100 px-2.5 py-2 rounded-lg border ${currentFilter === 'Not Applied' ? 'ring-2 ring-slate-700 border-slate-400' : 'border-slate-300'}">
            <div class="flex items-center justify-between">
                <span class="block text-slate-700 font-bold uppercase text-[9.5px]">Not Applied</span>
                <span class="text-[11px] text-slate-500">⚪</span>
            </div>
            <span class="font-black text-slate-900 text-sm font-mono block mt-0.5">${notAppliedTotal.toLocaleString()}</span>
        </div>

        <div onclick="quickFilterStatus('No Record Found')" title="Click to filter No Record Found" class="summary-stat-box bg-purple-50/80 px-2.5 py-2 rounded-lg border ${currentFilter === 'No Record Found' ? 'ring-2 ring-purple-600 border-purple-400' : 'border-purple-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-purple-800 font-bold uppercase text-[9.5px]">No Record</span>
                <span class="text-[11px] text-purple-600">❓</span>
            </div>
            <span class="font-black text-purple-900 text-sm font-mono block mt-0.5">${Number(row.no_record_members || 0).toLocaleString()}</span>
        </div>

        <div onclick="quickFilterStatus('Not Traceable')" title="Click to filter Not Traceable" class="summary-stat-box bg-rose-50/80 px-2.5 py-2 rounded-lg border ${currentFilter === 'Not Traceable' ? 'ring-2 ring-rose-600 border-rose-400' : 'border-rose-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-rose-800 font-bold uppercase text-[9.5px]">Not Traceable</span>
                <span class="text-[11px] text-rose-600">✕</span>
            </div>
            <span class="font-black text-rose-900 text-sm font-mono block mt-0.5">${Number(row.not_traceable_members || 0).toLocaleString()}</span>
        </div>

        <div onclick="quickFilterStatus('EXTRA_ONLY')" title="Click to filter Extra Added" class="summary-stat-box bg-indigo-50/80 px-2.5 py-2 rounded-lg border ${currentFilter === 'EXTRA_ONLY' ? 'ring-2 ring-indigo-600 border-indigo-400' : 'border-indigo-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-indigo-800 font-bold uppercase text-[9.5px]">+ Extra Added</span>
                <span class="text-[11px] text-indigo-600">✨</span>
            </div>
            <span class="font-black text-indigo-900 text-sm font-mono block mt-0.5">+${extraTotal.toLocaleString()}</span>
        </div>

        <div onclick="quickFilterStatus('UNCOVERED_FAMILY')" title="Click to filter Uncovered Families (0 Approved Members)" class="summary-stat-box bg-orange-50/80 px-2.5 py-2 rounded-lg border ${currentFilter === 'UNCOVERED_FAMILY' ? 'ring-2 ring-orange-600 border-orange-400' : 'border-orange-200'}">
            <div class="flex items-center justify-between">
                <span class="block text-orange-800 font-bold uppercase text-[9.5px]">Uncovered Fam</span>
                <span class="text-[11px] text-orange-600">🏠</span>
            </div>
            <span class="font-black text-orange-900 text-sm font-mono block mt-0.5">${Number(uncoveredFamCount || 0).toLocaleString()}</span>
        </div>
    `;
}

async function confirmAddMember() {
    if (!pendingAddFamilyContext) return;
    const authBlock = getAuthorizedBlock();
    if (!authBlock) return;

    const targetBlock = (authBlock === 'ALL' && isMasterAdmin())
        ? pendingAddFamilyContext.block_name
        : authBlock;
    const targetGp = pendingAddFamilyContext.gp_name;

    const nameInput = document.getElementById('newMemberName').value.trim().toUpperCase();
    const statusInput = document.getElementById('newMemberStatus').value;
    const saveBtn = document.getElementById('saveNewMemberBtn');
    const statusText = document.getElementById('syncStatusText');

    if (!nameInput) {
        showToast("Please enter the Member Name.", "warning");
        document.getElementById('newMemberName').focus();
        return;
    }

    // Internal unique key masked as blank on UI & Excel
    const internalKey = `EXTRA_${pendingAddFamilyContext.family_id}_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;

    const newRecord = {
        family_id: pendingAddFamilyContext.family_id,
        member_id: internalKey,
        block_name: targetBlock,
        gram_panchayat_name: pendingAddFamilyContext.gp_name,
        mobile_no: pendingAddFamilyContext.mobile_no,
        member_name: nameInput,
        STATUS: statusInput,
        updated_at: new Date().toISOString()
    };

    try {
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
        statusText.innerText = "Adding Member...";

        const { error } = await supabaseClient
            .from('bocw_members')
            .insert([newRecord]);

        if (error) throw error;

        currentLoadedRecords.push(newRecord);
        currentTotalCount = (currentTotalCount || 0) + 1;
        closeAddMemberModal();
        renderFamilyGroups(currentLoadedRecords, currentTotalCount);
        updatePaginationControls(currentTotalCount);

        // Optimistic local update for extra member
        if (cachedLeaderboard) {
            const blkRow = cachedLeaderboard.find(r => r.block_name === targetBlock);
            if (blkRow) {
                blkRow.extra_added_members = Number(blkRow.extra_added_members || 0) + 1;
                let field = 'not_applied_members';
                if (statusInput === 'Approved') field = 'approved_members';
                else if (statusInput === 'Portal Pending') field = 'pending_members';
                else if (statusInput === 'No Record Found') field = 'no_record_members';
                else if (statusInput === 'Not Traceable') field = 'not_traceable_members';
                blkRow[field] = Number(blkRow[field] || 0) + 1;
            }
        }

        // Live update GP cache & dropdown counter on member addition
        if (gpCacheByBlock && gpCacheByBlock.has(targetBlock) && targetGp) {
            const gps = gpCacheByBlock.get(targetBlock);
            const gpEntry = gps && gps.find(g => g.gram_panchayat_name === targetGp);
            if (gpEntry) {
                gpEntry.extra_added_members = Number(gpEntry.extra_added_members || 0) + 1;
                let field = 'not_applied_members';
                if (statusInput === 'Approved') field = 'approved_members';
                else if (statusInput === 'Portal Pending') field = 'pending_members';
                else if (statusInput === 'No Record Found') field = 'no_record_members';
                else if (statusInput === 'Not Traceable') field = 'not_traceable_members';
                gpEntry[field] = Number(gpEntry[field] || 0) + 1;

                if (statusInput !== 'Not Applied') {
                    gpEntry.processed_members = Number(gpEntry.processed_members ?? 0) + 1;
                    gpEntry.latest_timestamp = new Date().toISOString();
                }
                const gpSelect = document.getElementById('gpSelector');
                if (gpSelect) {
                    const opt = Array.from(gpSelect.options).find(o => o.value === targetGp);
                    if (opt) {
                        const count = Number(gpEntry.processed_members ?? gpEntry.approved_members ?? 0);
                        const total = Number(gpEntry.total_members ?? 0);
                        opt.innerText = formatGPOptionText(targetGp, count, total, gpEntry.latest_timestamp);
                    }
                }
            }
        }
        renderSummaryBarFromLeaderboard(authBlock);
        statusText.innerText = `✓ Added ${nameInput}`;
        showToast(`Member "${nameInput}" added to Family ${newRecord.family_id}`, "success");
    } catch (err) {
        showToast(`Could not add member: ${err.message}`, "error");
        statusText.innerText = "Add Failed";
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "+ Save Member to Family";
    }
}

async function deleteExtraMember(internalMemberId, memberName) {
    if (!String(internalMemberId).startsWith('EXTRA_')) return;
    const authBlock = getAuthorizedBlock();
    if (!authBlock) return;
    if (!confirm(`Remove added member "${memberName}" from this family?`)) return;

    const statusText = document.getElementById('syncStatusText');
    try {
        statusText.innerText = "Removing...";
        let delQuery = supabaseClient
            .from('bocw_members')
            .delete()
            .eq('member_id', String(internalMemberId));

        if (authBlock !== 'ALL' || !isMasterAdmin()) {
            delQuery = delQuery.eq('block_name', authBlock);
        }

        const { error } = await delQuery;
        if (error) throw error;

        const deletedRec = currentLoadedRecords.find(r => String(r.member_id) === String(internalMemberId));
        if (deletedRec && cachedLeaderboard) {
            const blkName = deletedRec.block_name || authBlock;
            const blkRow = cachedLeaderboard.find(r => r.block_name === blkName);
            if (blkRow) {
                blkRow.extra_added_members = Math.max(0, Number(blkRow.extra_added_members || 0) - 1);
                const st = cleanStatus(deletedRec.STATUS);
                let field = 'not_applied_members';
                if (st === 'Approved') field = 'approved_members';
                else if (st === 'Portal Pending') field = 'pending_members';
                else if (st === 'No Record Found') field = 'no_record_members';
                else if (st === 'Not Traceable') field = 'not_traceable_members';
                blkRow[field] = Math.max(0, Number(blkRow[field] || 0) - 1);
            }
        }

        if (deletedRec && gpCacheByBlock) {
            const blkName = deletedRec.block_name || authBlock;
            const gpName = deletedRec.gram_panchayat_name;
            const st = cleanStatus(deletedRec.STATUS);
            if (gpCacheByBlock.has(blkName) && gpName) {
                const gps = gpCacheByBlock.get(blkName);
                const gpEntry = gps && gps.find(g => g.gram_panchayat_name === gpName);
                if (gpEntry) {
                    gpEntry.extra_added_members = Math.max(0, Number(gpEntry.extra_added_members || 0) - 1);
                    let field = 'not_applied_members';
                    if (st === 'Approved') field = 'approved_members';
                    else if (st === 'Portal Pending') field = 'pending_members';
                    else if (st === 'No Record Found') field = 'no_record_members';
                    else if (st === 'Not Traceable') field = 'not_traceable_members';
                    gpEntry[field] = Math.max(0, Number(gpEntry[field] || 0) - 1);

                    if (st !== 'Not Applied') {
                        gpEntry.processed_members = Math.max(0, Number(gpEntry.processed_members ?? 0) - 1);
                    }
                    const gpSelect = document.getElementById('gpSelector');
                    if (gpSelect) {
                        const opt = Array.from(gpSelect.options).find(o => o.value === gpName);
                        if (opt) {
                            const count = Number(gpEntry.processed_members ?? gpEntry.approved_members ?? 0);
                            const total = Number(gpEntry.total_members ?? 0);
                            opt.innerText = formatGPOptionText(gpName, count, total, gpEntry.latest_timestamp);
                        }
                    }
                }
            }
        }

        currentLoadedRecords = currentLoadedRecords.filter(r => String(r.member_id) !== String(internalMemberId));
        currentTotalCount = Math.max(currentLoadedRecords.length, (currentTotalCount || 1) - 1);
        renderFamilyGroups(currentLoadedRecords, currentTotalCount);
        updatePaginationControls(currentTotalCount);
        renderSummaryBarFromLeaderboard(authBlock);
        statusText.innerText = "✓ Removed Extra Member";
        showToast(`Removed member "${memberName}"`, "info");
    } catch (err) {
        showToast(`Failed to remove member: ${err.message}`, "error");
        statusText.innerText = "Delete Error";
    }
}

async function toggleMemberStatus(memberId, clickedStatus) {
    const rec = currentLoadedRecords.find(r => String(r.member_id) === String(memberId));
    if (!rec) return;

    const currentStatus = cleanStatus(rec.STATUS);
    const newStatus = (currentStatus === clickedStatus) ? 'Not Applied' : clickedStatus;
    await saveMemberStatus(memberId, newStatus, null);
}

async function handleNotTraceableClick(targetType, id, currentStatus) {
    if (targetType === 'member' && currentStatus === 'Not Traceable') {
        await saveMemberStatus(id, 'Not Applied', null);
        return;
    }
    if (targetType === 'family') {
        const famMembers = currentLoadedRecords.filter(r => String(r.family_id) === String(id));
        const allTraceable = famMembers.length > 0 && famMembers.every(r => cleanStatus(r.STATUS) === 'Not Traceable');
        if (allTraceable) {
            await saveFamilyStatus(id, 'Not Applied', null);
            return;
        }
    }

    pendingTraceableTarget = { type: targetType, id: id };
    const displayId = String(id).startsWith('EXTRA_') ? 'Added Member' : id;
    document.getElementById('reasonModalSubtitle').innerText = targetType === 'family'
        ? `Select reason for marking entire Family ID ${displayId} as Not Traceable:`
        : `Select reason for marking ${displayId} as Not Traceable:`;
    document.getElementById('reasonModal').classList.remove('hidden');
}

async function confirmNotTraceable() {
    if (!pendingTraceableTarget) return;
    const selectedReason = document.getElementById('reasonDropdown').value;
    const target = { ...pendingTraceableTarget };
    closeReasonModal();

    if (target.type === 'member') {
        await saveMemberStatus(target.id, 'Not Traceable', selectedReason);
    } else {
        await saveFamilyStatus(target.id, 'Not Traceable', selectedReason);
    }
}

async function saveMemberStatus(memberId, status, remark) {
    const authBlock = getAuthorizedBlock();
    if (!authBlock) return;
    const statusText = document.getElementById('syncStatusText');
    try {
        statusText.innerText = `Saving...`;
        const rec = currentLoadedRecords.find(r => String(r.member_id) === String(memberId));
        const finalRemark = buildRemarkWithCopied(remark, rec ? rec.remark : '');

        let updQuery = supabaseClient
            .from('bocw_members')
            .update({
                STATUS: status,
                remark: finalRemark,
                updated_at: new Date().toISOString()
            })
            .eq('member_id', String(memberId));

        if (authBlock !== 'ALL' || !isMasterAdmin()) {
            updQuery = updQuery.eq('block_name', authBlock);
        }

        let { error } = await updQuery;

        if (error) {
            let fallbackQuery = supabaseClient
                .from('bocw_members')
                .update({ STATUS: status })
                .eq('member_id', String(memberId));
            if (authBlock !== 'ALL' || !isMasterAdmin()) {
                fallbackQuery = fallbackQuery.eq('block_name', authBlock);
            }
            const fallback = await fallbackQuery;
            if (fallback.error) throw fallback.error;
        }

        const oldStatus = rec ? cleanStatus(rec.STATUS) : 'Not Applied';
        const gpName = rec ? rec.gram_panchayat_name : '';
        const recBlock = rec ? (rec.block_name || authBlock) : authBlock;

        if (rec) {
            rec.STATUS = status;
            rec.remark = finalRemark;
        }

        // Optimistic in-memory counter updates (0 database round-trips)
        applyLocalStatusDelta(recBlock, oldStatus, status, 1);
        applyLocalGpApprovalDelta(recBlock, gpName, oldStatus, status, 1);
        if (oldStatus === 'Approved' || status === 'Approved') {
            if (typeof coveredFamilyIdsCache !== 'undefined' && coveredFamilyIdsCache) coveredFamilyIdsCache.clear();
        }

        statusText.innerText = `✓ Saved Status`;
        renderFamilyGroups(currentLoadedRecords, currentTotalCount || currentLoadedRecords.length);
        renderSummaryBarFromLeaderboard(authBlock);
        loadGPDropdown(true, false);
        showToast(`Updated status: ${status}`, status === 'Approved' ? 'success' : 'info', 1800);
    } catch (err) {
        showToast(`Failed to save status: ${err.message}`, "error");
        statusText.innerText = "Save Failed";
    }
}

async function toggleFamilyStatus(familyId, clickedStatus) {
    const famMembers = currentLoadedRecords.filter(r => String(r.family_id) === String(familyId));
    const allSame = famMembers.length > 0 && famMembers.every(r => cleanStatus(r.STATUS) === clickedStatus);
    const newStatus = allSame ? 'Not Applied' : clickedStatus;
    await saveFamilyStatus(familyId, newStatus, null);
}

async function saveFamilyStatus(familyId, status, remark) {
    const authBlock = getAuthorizedBlock();
    if (!authBlock) return;
    const statusText = document.getElementById('syncStatusText');
    try {
        statusText.innerText = `Updating Family ${familyId}...`;
        const famWasCopied = currentLoadedRecords.some(
            r => String(r.family_id) === String(familyId) && isRecordCopied(r.remark)
        );
        const finalRemark = buildRemarkWithCopied(remark, famWasCopied ? COPIED_MARKER : '');

        let updQuery = supabaseClient
            .from('bocw_members')
            .update({
                STATUS: status,
                remark: finalRemark,
                updated_at: new Date().toISOString()
            })
            .eq('family_id', String(familyId));

        if (authBlock !== 'ALL' || !isMasterAdmin()) {
            updQuery = updQuery.eq('block_name', authBlock);
        }

        let { error } = await updQuery;

        if (error) {
            let fallbackQuery = supabaseClient
                .from('bocw_members')
                .update({ STATUS: status })
                .eq('family_id', String(familyId));
            if (authBlock !== 'ALL' || !isMasterAdmin()) {
                fallbackQuery = fallbackQuery.eq('block_name', authBlock);
            }
            const fallback = await fallbackQuery;
            if (fallback.error) throw fallback.error;
        }

        const famMembers = currentLoadedRecords.filter(r => String(r.family_id) === String(familyId));
        famMembers.forEach(m => {
            const oldStatus = cleanStatus(m.STATUS);
            const mBlock = m.block_name || authBlock;
            const mGp = m.gram_panchayat_name || '';
            applyLocalStatusDelta(mBlock, oldStatus, status, 1);
            applyLocalGpApprovalDelta(mBlock, mGp, oldStatus, status, 1);
            m.STATUS = status;
            m.remark = finalRemark;
        });

        if (typeof coveredFamilyIdsCache !== 'undefined' && coveredFamilyIdsCache) coveredFamilyIdsCache.clear();

        statusText.innerText = `✓ Saved Family ${familyId}`;
        renderFamilyGroups(currentLoadedRecords, currentTotalCount || currentLoadedRecords.length);
        renderSummaryBarFromLeaderboard(authBlock);
        loadGPDropdown(true, false);
        showToast(`Family ${familyId} marked as ${status}`, status === 'Approved' ? 'success' : 'info', 2200);
    } catch (err) {
        showToast(`Failed to update Family: ${err.message}`, "error");
        statusText.innerText = "Save Failed";
    }
}
