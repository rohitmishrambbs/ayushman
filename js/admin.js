/**
 * ============================================================================
 * ACMO District Command View - Leaderboard, Daily Progress, Filter & Audit
 * ============================================================================
 */

function switchAdminWorkspaceTab(tab) {
    const viewSelect = document.getElementById('adminViewSelector');
    const lbPanel = document.getElementById('adminTabPanelLeaderboard');
    const dailyPanel = document.getElementById('adminTabPanelDaily');
    const filterDrawer = document.getElementById('adminFilterDrawer');
    const topCtrlLb = document.getElementById('adminTopCtrlLeaderboard');
    const topCtrlDaily = document.getElementById('adminTopCtrlDaily');

    if (viewSelect && viewSelect.value !== tab) {
        viewSelect.value = tab;
    }

    if (lbPanel) lbPanel.classList.add('hidden');
    if (dailyPanel) dailyPanel.classList.add('hidden');
    if (filterDrawer) filterDrawer.classList.add('hidden');
    if (topCtrlLb) {
        topCtrlLb.classList.add('hidden');
        topCtrlLb.classList.remove('flex');
    }
    if (topCtrlDaily) {
        topCtrlDaily.classList.add('hidden');
        topCtrlDaily.classList.remove('flex');
    }

    if (tab === 'daily') {
        if (dailyPanel) dailyPanel.classList.remove('hidden');
        if (topCtrlDaily) {
            topCtrlDaily.classList.remove('hidden');
            topCtrlDaily.classList.add('flex');
        }
    } else if (tab === 'filter') {
        if (filterDrawer) filterDrawer.classList.remove('hidden');
        updateAdminFilterMatchCount();
    } else {
        if (lbPanel) lbPanel.classList.remove('hidden');
        if (topCtrlLb) {
            topCtrlLb.classList.remove('hidden');
            topCtrlLb.classList.add('flex');
        }
    }
}

function toggleAdminFilterDrawer(forceState) {
    const drawer = document.getElementById('adminFilterDrawer');
    if (!drawer) return;
    const willOpen = typeof forceState === 'boolean' ? forceState : drawer.classList.contains('hidden');
    switchAdminWorkspaceTab(willOpen ? 'filter' : 'leaderboard');
}

function dismissAntiCheatBanner() {
    const banner = document.getElementById('antiCheatBanner');
    if (banner) banner.classList.add('hidden');
}

function filterLeaderboardRows(query) {
    const q = (query || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#leaderboardTableBody tr');
    rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        if (!q || text.includes(q)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
}

function getIstDateString(offsetDays = 0) {
    const now = new Date();
    // Convert current time to IST (+05:30)
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 3600000) + (offsetDays * 86400000));
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function setDailyReportDateOffset(offsetDays) {
    if (!isMasterAdmin()) return;
    const dateInput = document.getElementById('dailyProgressDate');
    if (dateInput) {
        dateInput.value = getIstDateString(offsetDays);
    }
    loadDailyProgressReport();
}

async function loadAdminLeaderboard() {
    if (!isMasterAdmin()) {
        return;
    }

    const dateInput = document.getElementById('dailyProgressDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = getIstDateString(0);
    }

    const tbody = document.getElementById('leaderboardTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="p-10 text-center text-slate-400">
                <div class="flex flex-col items-center justify-center gap-2">
                    <div class="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-xs font-semibold text-slate-600">Calculating real-time stats across all 70,673 records...</span>
                </div>
            </td>
        </tr>
    `;

    updateAdminFilterMatchCount();

    try {
        const { data, error } = await supabaseClient.rpc('get_block_leaderboard');
        if (error) throw error;

        cachedLeaderboard = data || [];
        if (cachedLeaderboard.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">No records found.</td></tr>`;
            return;
        }

        let distM = 0, distF = 0, distApp = 0, distPend = 0, distNoRec = 0, distTr = 0, distNA = 0, distExtra = 0;
        tbody.innerHTML = '';

        cachedLeaderboard.forEach((row, i) => {
            const tM = Number(row.total_members || 0);
            const tF = Number(row.total_families || 0);
            const appM = Number(row.approved_members || 0);
            const pendM = Number(row.pending_members || 0);
            const naM = Number(row.not_applied_members || 0) + Number(row.unidentified_members || 0);
            const noRecM = Number(row.no_record_members || 0);
            const trM = Number(row.not_traceable_members || 0);
            const exM = Number(row.extra_added_members || 0);
            const pct = tM > 0 ? ((appM / tM) * 100).toFixed(1) : '0.0';

            distM += tM; distF += tF; distApp += appM; distPend += pendM;
            distNoRec += noRecM; distTr += trM; distNA += naM; distExtra += exM;

            let rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">${i + 1}</span>`;
            if (i === 0) rankBadge = `<span class="text-base" title="Rank 1">🥇</span>`;
            else if (i === 1) rankBadge = `<span class="text-base" title="Rank 2">🥈</span>`;
            else if (i === 2) rankBadge = `<span class="text-base" title="Rank 3">🥉</span>`;

            // Progress bar color based on percentage
            let barColor = 'bg-emerald-500';
            if (Number(pct) < 10) barColor = 'bg-slate-400';
            else if (Number(pct) < 25) barColor = 'bg-indigo-500';

            const tr = document.createElement('tr');
            tr.className = "hover:bg-indigo-50/70 group cursor-pointer transition-colors duration-150";
            tr.title = `Click to switch to ${row.block_name} DEO Terminal`;
            tr.onclick = () => {
                if (!isMasterAdmin()) return;
                document.getElementById('blockSelector').value = row.block_name;
                switchRole('deo');
                onBlockChange();
                showToast(`Switched to ${row.block_name} Terminal`, 'info', 2000);
            };

            tr.innerHTML = `
                <td class="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                    ${rankBadge}
                    <span>${row.block_name}</span>
                    <span class="opacity-0 group-hover:opacity-100 text-indigo-600 text-xs font-normal transition-opacity">↗</span>
                </td>
                <td class="p-3.5 text-right font-mono text-slate-600">${tF.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-slate-800">${tM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">${appM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-amber-700">${pendM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-slate-700">${naM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-purple-600">${noRecM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-rose-700">${trM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-bold text-indigo-700">+${exM.toLocaleString()}</td>
                <td class="p-3.5">
                    <div class="flex items-center gap-2">
                        <div class="w-20 bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div>
                        </div>
                        <span class="text-xs font-bold text-slate-800 font-mono">${pct}%</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const distPct = distM > 0 ? ((distApp / distM) * 100).toFixed(2) : '0.00';
        document.getElementById('statTotalMembers').innerText = distM.toLocaleString();
        document.getElementById('statTotalFamilies').innerText = `${distF.toLocaleString()} Fam`;
        document.getElementById('statApproved').innerText = distApp.toLocaleString();
        document.getElementById('statApprovedPct').innerText = `${distPct}%`;
        document.getElementById('statPending').innerText = distPend.toLocaleString();
        document.getElementById('statNotApplied').innerText = distNA.toLocaleString();
        document.getElementById('statOther').innerText = (distNoRec + distTr).toLocaleString();
        document.getElementById('statExtraAdded').innerText = `+${distExtra.toLocaleString()}`;

        // Re-apply block search filter if user had typed something
        const searchInput = document.getElementById('leaderboardSearchInput');
        if (searchInput && searchInput.value) {
            filterLeaderboardRows(searchInput.value);
        }

        await loadDailyProgressReport();
    } catch (err) {
        console.error("Leaderboard error:", err);
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-rose-600 font-semibold">Error: ${err.message}</td></tr>`;
        showToast(`Leaderboard Error: ${err.message}`, 'error');
    }
}

async function loadDailyProgressReport() {
    if (!isMasterAdmin()) return;

    const dateInput = document.getElementById('dailyProgressDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = getIstDateString(0);
    }
    const selectedDate = (dateInput && dateInput.value) ? dateInput.value : getIstDateString(0);
    currentDailyReportDate = selectedDate;

    const tbody = document.getElementById('dailyProgressTableBody');
    const subtitle = document.getElementById('dailyReportSubtitle');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">Scanning block-wise card approvals for <b>${selectedDate}</b> (IST)...</td></tr>`;
    }
    if (subtitle) {
        subtitle.innerText = `Showing card approvals & field updates recorded between 00:00 and 23:59 IST on ${selectedDate}.`;
    }

    try {
        const startIso = new Date(`${selectedDate}T00:00:00.000+05:30`).toISOString();
        const endIso = new Date(`${selectedDate}T23:59:59.999+05:30`).toISOString();

        // Fetch all records updated on selectedDate in 1,000-row pages
        const dailyRows = [];
        const chunkSize = 1000;
        let offset = 0;

        while (true) {
            const { data, error } = await supabaseClient
                .from('bocw_members')
                .select('block_name, family_id, member_id, STATUS, updated_at')
                .gte('updated_at', startIso)
                .lte('updated_at', endIso)
                .order('member_id', { ascending: true })
                .range(offset, offset + chunkSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            dailyRows.push(...data);
            if (data.length < chunkSize) break;
            offset += chunkSize;
        }

        // Initialize map for all 22 blocks
        const blockStatsMap = new Map();
        ALL_BLOCKS_META.forEach(b => {
            const lbRow = cachedLeaderboard.find(r => r.block_name === b.name);
            blockStatsMap.set(b.name, {
                block_name: b.name,
                daily_approved_total: 0,
                daily_approved_base: 0,
                daily_approved_extra: 0,
                daily_pending: 0,
                daily_excluded: 0,
                daily_total_processed: 0,
                families_set: new Set(),
                cumulative_approved: lbRow ? Number(lbRow.approved_members || 0) : 0,
                base_total: lbRow ? Number(lbRow.total_members || 0) : 0
            });
        });

        const districtFamiliesSet = new Set();

        dailyRows.forEach(r => {
            const blk = String(r.block_name ?? '').trim();
            if (!blk) return;

            const statusVal = cleanStatus(r.STATUS);
            if (statusVal === 'Not Applied') return;

            if (!blockStatsMap.has(blk)) {
                blockStatsMap.set(blk, {
                    block_name: blk,
                    daily_approved_total: 0,
                    daily_approved_base: 0,
                    daily_approved_extra: 0,
                    daily_pending: 0,
                    daily_excluded: 0,
                    daily_total_processed: 0,
                    families_set: new Set(),
                    cumulative_approved: 0,
                    base_total: 0
                });
            }

            const entry = blockStatsMap.get(blk);
            const isExtra = String(r.member_id ?? '').startsWith('EXTRA_');
            const famId = String(r.family_id ?? '');

            entry.daily_total_processed += 1;
            if (famId) {
                entry.families_set.add(famId);
                districtFamiliesSet.add(famId);
            }

            if (statusVal === 'Approved') {
                entry.daily_approved_total += 1;
                if (isExtra) {
                    entry.daily_approved_extra += 1;
                } else {
                    entry.daily_approved_base += 1;
                }
            } else if (statusVal === 'Portal Pending') {
                entry.daily_pending += 1;
            } else if (statusVal === 'No Record Found' || statusVal === 'Not Traceable') {
                entry.daily_excluded += 1;
            }
        });

        const sortedBlocks = Array.from(blockStatsMap.values()).map(item => ({
            ...item,
            daily_families: item.families_set.size
        })).sort((a, b) => {
            if (b.daily_approved_total !== a.daily_approved_total) {
                return b.daily_approved_total - a.daily_approved_total;
            }
            if (b.daily_total_processed !== a.daily_total_processed) {
                return b.daily_total_processed - a.daily_total_processed;
            }
            return a.block_name.localeCompare(b.block_name);
        });

        cachedDailyProgress = sortedBlocks;

        let totalDayApproved = 0;
        let totalDayApprovedBase = 0;
        let totalDayApprovedExtra = 0;
        let totalDayPending = 0;
        let totalDayProcessed = 0;
        let activeBlocksCount = 0;
        let zeroApprovedBlocksCount = 0;

        sortedBlocks.forEach(b => {
            totalDayApproved += b.daily_approved_total;
            totalDayApprovedBase += b.daily_approved_base;
            totalDayApprovedExtra += b.daily_approved_extra;
            totalDayPending += b.daily_pending;
            totalDayProcessed += b.daily_total_processed;
            if (b.daily_total_processed > 0) activeBlocksCount += 1;
            if (b.daily_approved_total === 0) zeroApprovedBlocksCount += 1;
        });

        document.getElementById('dailyStatApproved').innerText = totalDayApproved.toLocaleString();
        document.getElementById('dailyStatApprovedSub').innerText = `(${totalDayApprovedBase.toLocaleString()}B + ${totalDayApprovedExtra.toLocaleString()}Ex)`;
        document.getElementById('dailyStatPending').innerText = totalDayPending.toLocaleString();
        document.getElementById('dailyStatProcessed').innerText = totalDayProcessed.toLocaleString();
        document.getElementById('dailyStatFamilies').innerText = `${districtFamiliesSet.size.toLocaleString()} Fam`;
        document.getElementById('dailyStatActiveBlocks').innerText = `${activeBlocksCount}/${sortedBlocks.length}`;
        document.getElementById('dailyStatZeroBlocks').innerText = `${zeroApprovedBlocksCount} with 0 App`;

        const quickBadge = document.getElementById('dailyTabQuickBadge');
        if (quickBadge) {
            const isToday = selectedDate === getIstDateString(0);
            const labelPrefix = isToday ? 'Today' : selectedDate;
            quickBadge.innerText = `${labelPrefix}: +${totalDayApproved.toLocaleString()} Approved`;
        }

        tbody.innerHTML = '';

        sortedBlocks.forEach((row, idx) => {
            const tr = document.createElement('tr');
            const isZero = row.daily_approved_total === 0 && row.daily_total_processed === 0;
            tr.className = isZero
                ? "bg-rose-50/30 hover:bg-rose-50/70 cursor-pointer transition"
                : "hover:bg-indigo-50/50 cursor-pointer transition";

            tr.onclick = () => {
                if (!isMasterAdmin()) return;
                document.getElementById('blockSelector').value = row.block_name;
                document.getElementById('statusFilter').value = 'Approved';
                switchRole('deo');
                onBlockChange();
            };

            let statusBadge = '';
            if (row.daily_approved_total >= 25) {
                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">🔥 High Progress</span>`;
            } else if (row.daily_approved_total > 0) {
                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">✅ Active</span>`;
            } else if (row.daily_total_processed > 0) {
                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">⏳ Pending Only</span>`;
            } else {
                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">⚠️ 0 Activity</span>`;
            }

            const cumPct = row.base_total > 0 ? ((row.cumulative_approved / row.base_total) * 100).toFixed(1) : '0.0';

            tr.innerHTML = `
                <td class="p-3.5 font-bold text-slate-900">${idx + 1}. ${row.block_name}</td>
                <td class="p-3.5 text-right font-mono font-black text-base ${row.daily_approved_total > 0 ? 'text-emerald-700' : 'text-rose-500'}">
                    ${row.daily_approved_total > 0 ? `+${row.daily_approved_total.toLocaleString()}` : '0'}
                </td>
                <td class="p-3.5 text-right font-mono text-xs text-slate-600">
                    <span class="font-bold text-slate-800">${row.daily_approved_base.toLocaleString()}</span> Base / <span class="font-bold text-indigo-700">+${row.daily_approved_extra.toLocaleString()}</span> Ex
                </td>
                <td class="p-3.5 text-right font-mono font-semibold text-amber-600">${row.daily_pending.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-rose-600">${row.daily_excluded.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-bold text-slate-800">${row.daily_total_processed.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono text-slate-600">${row.daily_families.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono text-xs text-slate-700">
                    <span class="font-bold text-emerald-800">${row.cumulative_approved.toLocaleString()}</span> / ${row.base_total.toLocaleString()} (${cumPct}%)
                </td>
                <td class="p-3.5 text-center">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Daily progress report error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-rose-600 font-semibold">Error loading daily progress: ${err.message}</td></tr>`;
        }
    }
}

async function onAdminBlockFilterChange() {
    if (!isMasterAdmin()) return;

    const block = document.getElementById('adminBlockSelector').value;
    const gpSelect = document.getElementById('adminGpSelector');

    if (block === 'ALL') {
        gpSelect.innerHTML = `<option value="ALL">All Gram Panchayats (District-Wide)</option>`;
        await updateAdminFilterMatchCount();
        return;
    }

    gpSelect.innerHTML = `<option value="ALL">Loading GPs for ${block}...</option>`;
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
    } catch (err) {
        gpSelect.innerHTML = `<option value="ALL">All Gram Panchayats</option>`;
    }

    await updateAdminFilterMatchCount();
}

async function updateAdminFilterMatchCount() {
    if (!isMasterAdmin()) return;

    const blockEl = document.getElementById('adminBlockSelector');
    const gpEl = document.getElementById('adminGpSelector');
    const statusEl = document.getElementById('adminStatusFilter');
    const searchEl = document.getElementById('adminSearchInput');
    const badgeEl = document.getElementById('adminFilterCountBadge');

    if (!blockEl || !badgeEl) return;

    const block = blockEl.value || 'ALL';
    const gp = gpEl ? gpEl.value : 'ALL';
    const statusFilter = statusEl ? statusEl.value : 'ALL';
    const searchQuery = searchEl ? searchEl.value.trim() : '';

    badgeEl.innerText = 'Counting matching records...';

    try {
        let query = supabaseClient
            .from('bocw_members')
            .select('*', { count: 'exact', head: true });

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

        const { count, error } = await query;
        if (error) throw error;

        const scopeLabel = block === 'ALL' ? 'Across All 22 Blocks' : `in ${block}`;
        badgeEl.innerText = `Matching Records: ${(count || 0).toLocaleString()} Members (${scopeLabel})`;
    } catch (err) {
        badgeEl.innerText = 'Count unavailable';
    }
}

async function openFilteredInTerminal() {
    if (!isMasterAdmin()) return;

    const adminBlock = document.getElementById('adminBlockSelector').value;
    const adminGp = document.getElementById('adminGpSelector').value;
    const adminStatus = document.getElementById('adminStatusFilter').value;
    const adminSearch = document.getElementById('adminSearchInput').value.trim();

    document.getElementById('blockSelector').value = adminBlock;
    document.getElementById('statusFilter').value = adminStatus;
    document.getElementById('searchInput').value = adminSearch;

    switchRole('deo');
    currentPage = 1;
    await loadGPDropdown();
    if (adminBlock !== 'ALL' && adminGp !== 'ALL') {
        document.getElementById('gpSelector').value = adminGp;
    }
    await loadBlockData();
}

async function checkSpeedAnomalies() {
    if (!isMasterAdmin()) {
        return;
    }

    const banner = document.getElementById('antiCheatBanner');
    const velocityBtn = document.getElementById('velocityCheckBtn');
    banner.classList.remove('hidden');
    banner.className = "mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 text-xs font-semibold animate-fade-in";
    banner.innerHTML = `
        <div class="flex items-center gap-2.5">
            <div class="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Scanning recent update timestamps across blocks for velocity anomalies (>6 families/minute)...</span>
        </div>
    `;

    try {
        if (velocityBtn) velocityBtn.classList.add('opacity-75');
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabaseClient
            .from('bocw_members')
            .select('block_name, family_id, STATUS, updated_at')
            .neq('STATUS', 'Not Applied')
            .gte('updated_at', since)
            .order('updated_at', { ascending: false })
            .limit(1000);

        if (error) throw error;

        const minuteBuckets = {};
        (data || []).forEach(r => {
            if (!r.updated_at) return;
            const minKey = `${r.block_name}__${r.updated_at.substring(0, 16)}`;
            if (!minuteBuckets[minKey]) minuteBuckets[minKey] = new Set();
            minuteBuckets[minKey].add(r.family_id);
        });

        const anomalies = Object.entries(minuteBuckets)
            .filter(([_, famSet]) => famSet.size > 6)
            .map(([key, famSet]) => {
                const [blk, timeStr] = key.split('__');
                return `${blk} (${famSet.size} families in 1 min at ${timeStr.replace('T', ' ')})`;
            });

        if (anomalies.length === 0) {
            banner.className = "mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-bold animate-fade-in flex items-center justify-between gap-3";
            banner.innerHTML = `
                <div><span class="text-sm mr-1">✓</span> Velocity Audit Passed: No bulk-clicking anomalies (&gt;6 families/min) detected in the last 24 hours.</div>
                <button onclick="dismissAntiCheatBanner()" class="text-emerald-700 hover:text-emerald-950 font-black px-2 py-0.5 rounded cursor-pointer">✕</button>
            `;
            showToast("Velocity Audit: No anomalies detected", "success", 2500);
        } else {
            banner.className = "mb-4 p-4 rounded-xl border bg-rose-50 border-rose-300 text-rose-800 text-xs font-bold space-y-1 animate-fade-in";
            banner.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <p class="flex items-center gap-1.5"><span class="text-sm">⚠️</span> Speed Anomaly Detected (&gt;6 families updated in a single minute):</p>
                    <button onclick="dismissAntiCheatBanner()" class="text-rose-700 hover:text-rose-950 font-black px-2 py-0.5 rounded cursor-pointer">✕</button>
                </div>
                <p class="font-mono text-[11px] bg-rose-100/60 p-2 rounded-lg mt-1">${anomalies.join(' | ')}</p>
            `;
            showToast("Speed anomalies detected!", "warning", 3000);
        }
    } catch (err) {
        banner.className = "mb-4 p-4 rounded-xl border bg-rose-50 border-rose-300 text-rose-800 text-xs font-bold animate-fade-in";
        banner.innerText = `Velocity audit error: ${err.message}`;
        showToast(`Velocity audit error: ${err.message}`, "error");
    } finally {
        if (velocityBtn) velocityBtn.classList.remove('opacity-75');
    }
}
