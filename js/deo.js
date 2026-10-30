/**
 * ============================================================================
 * Block DEO Terminal - Data Fetching & Status Mutations
 * ============================================================================
 */

async function loadGPDropdown(preserveSelection = false) {
    const block = getAuthorizedBlock();
    if (!block) return;
    const gpSelect = document.getElementById('gpSelector');
    if (!gpSelect) return;

    const previousValue = preserveSelection ? gpSelect.value : 'ALL';

    if (block === 'ALL') {
        gpSelect.innerHTML = `<option value="ALL">All Gram Panchayats (District-Wide)</option>`;
        return;
    }

    if (!preserveSelection) {
        gpSelect.innerHTML = `<option value="ALL">Loading GPs for ${block}...</option>`;
    }

    try {
        const { data, error } = await supabaseClient.rpc('get_block_gps', { p_block: block });
        if (error) throw error;

        gpSelect.innerHTML = `<option value="ALL">All Gram Panchayats in ${block} (${data ? data.length : 0} GPs)</option>`;
        if (data && data.length > 0) {
            data.forEach(gp => {
                const gpName = String(gp.gram_panchayat_name ?? '');
                const opt = document.createElement('option');
                opt.value = gpName;
                opt.innerText = `${gpName} (${gp.approved_members}/${gp.total_members} Approved)`;
                gpSelect.appendChild(opt);
            });
        }

        if (preserveSelection && previousValue) {
            const exists = Array.from(gpSelect.options).some(o => o.value === previousValue);
            gpSelect.value = exists ? previousValue : 'ALL';
        }
    } catch (err) {
        if (!preserveSelection) {
            gpSelect.innerHTML = `<option value="ALL">All Gram Panchayats</option>`;
        }
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
    document.getElementById('activeBlockTitle').innerText = `${displayBlockTitle} Block Terminal`;

    const gp = document.getElementById('gpSelector').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.trim();
    const container = document.getElementById('familyListContainer');
    const statusText = document.getElementById('syncStatusText');

    try {
        statusText.innerText = "Fetching Cloud Data...";
        container.innerHTML = renderSkeletonLoader();

        let query = supabaseClient
            .from('bocw_members')
            .select('*', { count: 'exact' });

        if (block !== 'ALL') {
            query = query.eq('block_name', block);
        }

        if (gp !== 'ALL' && block !== 'ALL') {
            query = query.eq('gram_panchayat_name', gp);
        }

        if (statusFilter !== 'ALL') {
            if (statusFilter === 'EXTRA_ONLY') {
                query = query.ilike('member_id', 'EXTRA_%');
            } else if (statusFilter === 'Not Applied') {
                query = query.or('STATUS.is.null,STATUS.eq.Not Applied,STATUS.eq.Unidentified,STATUS.eq.NULL,STATUS.eq.');
            } else {
                query = query.eq('STATUS', statusFilter);
            }
        }

        if (searchQuery.length > 0) {
            const q = searchQuery.replace(/,/g, '');
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
        renderFamilyGroups(currentLoadedRecords, count || 0);
        updatePaginationControls(count || 0);
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
    showToast(`Filtering by: ${statusVal === 'ALL' ? 'All Statuses' : statusVal}`, 'info', 2000);
}

async function updateBlockSummaryBar(block) {
    const authorizedBlock = getAuthorizedBlock() || block;
    const bar = document.getElementById('blockSummaryBar');
    if (!bar) return;

    try {
        const { data, error } = await supabaseClient.rpc('get_block_leaderboard');
        if (error || !data) return;

        let row;
        if (authorizedBlock === 'ALL') {
            row = data.reduce((acc, r) => {
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
            row = data.find(r => r.block_name === authorizedBlock);
        }

        if (!row) return;

        const notAppliedTotal = Number(row.not_applied_members || 0) + Number(row.unidentified_members || 0);
        const extraTotal = Number(row.extra_added_members || 0);
        const currentFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'ALL';

        bar.innerHTML = `
            <div onclick="quickFilterStatus('ALL')" title="Click to show all records" class="summary-stat-box bg-slate-50 p-3 rounded-xl border ${currentFilter === 'ALL' ? 'ring-2 ring-slate-800 border-slate-400' : 'border-slate-200'}">
                <div class="flex items-center justify-between">
                    <span class="block text-slate-500 font-bold uppercase text-[10px]">Base Total</span>
                    <span class="text-xs text-slate-400">📋</span>
                </div>
                <div class="mt-1 flex items-baseline gap-1">
                    <span class="font-black text-slate-900 text-base font-mono">${Number(row.total_members || 0).toLocaleString()}</span>
                    <span class="font-normal text-[11px] text-slate-500">(${Number(row.total_families || 0).toLocaleString()} Fam)</span>
                </div>
            </div>

            <div onclick="quickFilterStatus('Approved')" title="Click to filter Approved" class="summary-stat-box bg-emerald-50/80 p-3 rounded-xl border ${currentFilter === 'Approved' ? 'ring-2 ring-emerald-600 border-emerald-400' : 'border-emerald-200'}">
                <div class="flex items-center justify-between">
                    <span class="block text-emerald-800 font-bold uppercase text-[10px]">Approved</span>
                    <span class="text-xs text-emerald-600">✓</span>
                </div>
                <span class="font-black text-emerald-900 text-base font-mono block mt-1">${Number(row.approved_members || 0).toLocaleString()}</span>
            </div>

            <div onclick="quickFilterStatus('Portal Pending')" title="Click to filter Portal Pending" class="summary-stat-box bg-amber-50/80 p-3 rounded-xl border ${currentFilter === 'Portal Pending' ? 'ring-2 ring-amber-600 border-amber-400' : 'border-amber-200'}">
                <div class="flex items-center justify-between">
                    <span class="block text-amber-800 font-bold uppercase text-[10px]">Portal Pending</span>
                    <span class="text-xs text-amber-600">⏳</span>
                </div>
                <span class="font-black text-amber-900 text-base font-mono block mt-1">${Number(row.pending_members || 0).toLocaleString()}</span>
            </div>

            <div onclick="quickFilterStatus('Not Applied')" title="Click to filter Not Applied" class="summary-stat-box bg-slate-100 p-3 rounded-xl border ${currentFilter === 'Not Applied' ? 'ring-2 ring-slate-700 border-slate-400' : 'border-slate-300'}">
                <div class="flex items-center justify-between">
                    <span class="block text-slate-700 font-bold uppercase text-[10px]">Not Applied</span>
                    <span class="text-xs text-slate-500">⚪</span>
                </div>
                <span class="font-black text-slate-900 text-base font-mono block mt-1">${notAppliedTotal.toLocaleString()}</span>
            </div>

            <div onclick="quickFilterStatus('No Record Found')" title="Click to filter No Record Found" class="summary-stat-box bg-purple-50/80 p-3 rounded-xl border ${currentFilter === 'No Record Found' ? 'ring-2 ring-purple-600 border-purple-400' : 'border-purple-200'}">
                <div class="flex items-center justify-between">
                    <span class="block text-purple-800 font-bold uppercase text-[10px]">No Record</span>
                    <span class="text-xs text-purple-600">❓</span>
                </div>
                <span class="font-black text-purple-900 text-base font-mono block mt-1">${Number(row.no_record_members || 0).toLocaleString()}</span>
            </div>

            <div onclick="quickFilterStatus('Not Traceable')" title="Click to filter Not Traceable" class="summary-stat-box bg-rose-50/80 p-3 rounded-xl border ${currentFilter === 'Not Traceable' ? 'ring-2 ring-rose-600 border-rose-400' : 'border-rose-200'}">
                <div class="flex items-center justify-between">
                    <span class="block text-rose-800 font-bold uppercase text-[10px]">Not Traceable</span>
                    <span class="text-xs text-rose-600">✕</span>
                </div>
                <span class="font-black text-rose-900 text-base font-mono block mt-1">${Number(row.not_traceable_members || 0).toLocaleString()}</span>
            </div>

            <div onclick="quickFilterStatus('EXTRA_ONLY')" title="Click to filter Extra Added" class="summary-stat-box bg-indigo-50/80 p-3 rounded-xl border ${currentFilter === 'EXTRA_ONLY' ? 'ring-2 ring-indigo-600 border-indigo-400' : 'border-indigo-200'}">
                <div class="flex items-center justify-between">
                    <span class="block text-indigo-800 font-bold uppercase text-[10px]">+ Extra Added</span>
                    <span class="text-xs text-indigo-600">✨</span>
                </div>
                <span class="font-black text-indigo-900 text-base font-mono block mt-1">+${extraTotal.toLocaleString()}</span>
            </div>
        `;
    } catch (e) {
        console.error("Summary bar error:", e);
    }
}

async function confirmAddMember() {
    if (!pendingAddFamilyContext) return;
    const authBlock = getAuthorizedBlock();
    if (!authBlock) return;

    const targetBlock = (authBlock === 'ALL' && isMasterAdmin())
        ? pendingAddFamilyContext.block_name
        : authBlock;

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
        closeAddMemberModal();
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(authBlock);
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

        currentLoadedRecords = currentLoadedRecords.filter(r => String(r.member_id) !== String(internalMemberId));
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(authBlock);
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
        let updQuery = supabaseClient
            .from('bocw_members')
            .update({
                STATUS: status,
                remark: remark,
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

        const rec = currentLoadedRecords.find(r => String(r.member_id) === String(memberId));
        if (rec) {
            rec.STATUS = status;
            rec.remark = remark;
            trackDeoVelocityAndAlert({
                blockName: rec.block_name || authBlock,
                familyId: rec.family_id,
                gpName: rec.gram_panchayat_name || '',
                status: status
            });
        }

        statusText.innerText = `✓ Saved Status`;
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(authBlock);
        loadGPDropdown(true);
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
        let updQuery = supabaseClient
            .from('bocw_members')
            .update({
                STATUS: status,
                remark: remark,
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

        let sampleRec = null;
        currentLoadedRecords.forEach(r => {
            if (String(r.family_id) === String(familyId)) {
                r.STATUS = status;
                r.remark = remark;
                if (!sampleRec) sampleRec = r;
            }
        });

        trackDeoVelocityAndAlert({
            blockName: (sampleRec && sampleRec.block_name) ? sampleRec.block_name : authBlock,
            familyId: familyId,
            gpName: (sampleRec && sampleRec.gram_panchayat_name) ? sampleRec.gram_panchayat_name : '',
            status: status
        });

        statusText.innerText = `✓ Saved Family ${familyId}`;
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(authBlock);
        loadGPDropdown(true);
        showToast(`Family ${familyId} marked as ${status}`, status === 'Approved' ? 'success' : 'info', 2200);
    } catch (err) {
        showToast(`Failed to update Family: ${err.message}`, "error");
        statusText.innerText = "Save Failed";
    }
}

/**
 * ============================================================================
 * Real-Time Block DEO Speed Anomaly Detector & Email Dispatcher (>3 Fam/Min)
 * ============================================================================
 */
const ANOMALY_REPORT_EMAIL = 'rm.pmhs@gmail.com';
const ANOMALY_FAMILY_LIMIT_PER_MIN = 3; // Triggers when a Block DEO exceeds 3 families/min (4+ families in 60s)
const DEO_VELOCITY_LOG_KEY = 'bocw_deo_velocity_log_v1';
const DEO_ANOMALY_COOLDOWN_KEY = 'bocw_deo_anomaly_cooldown_v1';
let deoAnomalyEmailTimer = null;

function formatIstTimestamp(ms = Date.now()) {
    return new Date(ms).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }) + ' IST';
}

function trackDeoVelocityAndAlert({ blockName, familyId, gpName, status }) {
    // Only monitor Block DEO sessions (not ACMO Master) and non-reset status updates
    if (isMasterAdmin()) return;
    if (!blockName || !familyId || cleanStatus(status) === 'Not Applied') return;

    const now = Date.now();
    const windowStart = now - 60 * 1000; // Rolling 60-second window

    let log = [];
    try {
        const raw = localStorage.getItem(DEO_VELOCITY_LOG_KEY);
        if (raw) log = JSON.parse(raw);
    } catch (_) {
        log = [];
    }

    // Keep only events from the last 60 seconds for this block
    log = (Array.isArray(log) ? log : []).filter(item => item && item.ts >= windowStart && item.block === blockName);

    log.push({
        block: String(blockName),
        familyId: String(familyId),
        gp: String(gpName || ''),
        status: String(status),
        ts: now,
        timeLabel: formatIstTimestamp(now)
    });

    try {
        localStorage.setItem(DEO_VELOCITY_LOG_KEY, JSON.stringify(log));
    } catch (_) {}

    // Group by unique family_id in the last 60 seconds
    const uniqueFamiliesMap = new Map();
    log.forEach(item => {
        uniqueFamiliesMap.set(item.familyId, item);
    });

    if (uniqueFamiliesMap.size > ANOMALY_FAMILY_LIMIT_PER_MIN) {
        // Debounce by 2.5 seconds to capture the full burst if DEO is still clicking rapidly
        if (deoAnomalyEmailTimer) clearTimeout(deoAnomalyEmailTimer);
        deoAnomalyEmailTimer = setTimeout(() => {
            dispatchRealTimeAnomalyEmail(blockName);
        }, 2500);
    }
}

async function dispatchRealTimeAnomalyEmail(blockName) {
    const now = Date.now();
    const windowStart = now - 65 * 1000;

    // Check 3-minute per-block cooldown to prevent inbox flooding during a single burst
    let cooldownMap = {};
    try {
        const rawCd = localStorage.getItem(DEO_ANOMALY_COOLDOWN_KEY);
        if (rawCd) cooldownMap = JSON.parse(rawCd) || {};
    } catch (_) {
        cooldownMap = {};
    }

    if (cooldownMap[blockName] && (now - cooldownMap[blockName]) < 3 * 60 * 1000) {
        return;
    }

    let log = [];
    try {
        const raw = localStorage.getItem(DEO_VELOCITY_LOG_KEY);
        if (raw) log = JSON.parse(raw);
    } catch (_) {
        log = [];
    }

    const recentBlockEvents = (Array.isArray(log) ? log : []).filter(
        item => item && item.ts >= windowStart && item.block === blockName
    );

    const uniqueFamiliesMap = new Map();
    recentBlockEvents.forEach(item => {
        uniqueFamiliesMap.set(item.familyId, item);
    });

    const famCount = uniqueFamiliesMap.size;
    if (famCount <= ANOMALY_FAMILY_LIMIT_PER_MIN) return;

    // Lock cooldown immediately before network call
    cooldownMap[blockName] = now;
    try {
        localStorage.setItem(DEO_ANOMALY_COOLDOWN_KEY, JSON.stringify(cooldownMap));
    } catch (_) {}

    const familyListSummary = Array.from(uniqueFamiliesMap.values())
        .map((f, idx) => `${idx + 1}. Family ID: ${f.familyId} (${f.gp || 'GP N/A'}) -> ${f.status} [${f.timeLabel}]`)
        .join(' | ');

    const deoUsername = (currentSession && currentSession.username) ? currentSession.username : `DEO_${blockName}`;
    const detectedTimeIst = formatIstTimestamp(now);

    try {
        await fetch(`https://formsubmit.co/ajax/${ANOMALY_REPORT_EMAIL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                _subject: `🚨 [BoCW Azamgarh] Speed Anomaly Alert: ${blockName} (${famCount} Families/Min)`,
                _template: 'table',
                _captcha: 'false',
                Alert_Type: 'Real-Time Block DEO Speed Anomaly (>3 Families/Min)',
                Block_Name: blockName,
                DEO_Login_ID: deoUsername,
                Detected_At_IST: detectedTimeIst,
                Velocity_Rate: `${famCount} Unique Families updated within 60 seconds (Threshold: >3 Families/Min)`,
                Updated_Families_Breakdown: familyListSummary
            })
        });
    } catch (err) {
        console.error('Real-time anomaly email dispatch error:', err);
    }
}
