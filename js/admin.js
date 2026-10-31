/**
 * ============================================================================
 * ACMO District Command View - Leaderboard, Daily Progress, Filter & Audit
 * ============================================================================
 */

// ============================================================================
// Table Sorting State & Icon Manager for ACMO Tables
// ============================================================================
let leaderboardSortState = { col: null, asc: false };
let dailyProgressSortState = { col: null, asc: false };
let copiedReportSortState = { col: null, asc: false };
let districtProgressMode = 'all';

function updateSortIcons(tableId, sortState) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('th[data-sort]').forEach(th => {
        const col = th.getAttribute('data-sort');
        const indicator = th.querySelector('.sort-indicator');
        if (!indicator) return;
        if (col === sortState.col) {
            indicator.innerText = sortState.asc ? '▲' : '▼';
            indicator.className = 'sort-indicator text-[11px] text-indigo-600 font-bold';
        } else {
            indicator.innerText = '↕';
            indicator.className = 'sort-indicator text-[11px] text-slate-400 group-hover:text-slate-600';
        }
    });
}

function updateDistrictProgressModeButtons() {
    const btnAll = document.getElementById('progressModeBtnAll');
    const btnToday = document.getElementById('progressModeBtnToday');
    const btnYesterday = document.getElementById('progressModeBtnYesterday');

    const activeCls = "px-2.5 py-1.5 bg-indigo-600 text-white border border-indigo-600 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs";
    const inactiveCls = "px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer";

    const todayStr = getIstDateString(0);
    const yesterdayStr = getIstDateString(-1);
    const fromVal = (document.getElementById('dailyProgressFromDate') || {}).value || '';
    const toVal = (document.getElementById('dailyProgressToDate') || {}).value || '';
    const isSingleDay = fromVal && fromVal === toVal;

    if (btnAll) {
        btnAll.className = districtProgressMode === 'all' ? activeCls : inactiveCls;
    }
    if (btnToday) {
        btnToday.className = (districtProgressMode === 'date' && isSingleDay && fromVal === todayStr) ? activeCls : inactiveCls;
    }
    if (btnYesterday) {
        btnYesterday.className = (districtProgressMode === 'date' && isSingleDay && fromVal === yesterdayStr) ? activeCls : inactiveCls;
    }
}

function setDistrictProgressMode(mode) {
    districtProgressMode = mode === 'date' ? 'date' : 'all';
    const lbPanel = document.getElementById('adminTabPanelLeaderboard');
    const dailyPanel = document.getElementById('adminTabPanelDaily');
    const viewSelect = document.getElementById('adminViewSelector');

    if (viewSelect && viewSelect.value === 'leaderboard') {
        if (districtProgressMode === 'date') {
            if (lbPanel) lbPanel.classList.add('hidden');
            if (dailyPanel) dailyPanel.classList.remove('hidden');
        } else {
            if (dailyPanel) dailyPanel.classList.add('hidden');
            if (lbPanel) lbPanel.classList.remove('hidden');
        }
    }
    updateDistrictProgressModeButtons();
}

function onDailyDateInputChange() {
    setDistrictProgressMode('date');
    loadDailyProgressReport();
}

function exportDistrictProgressExcel() {
    if (districtProgressMode === 'date') {
        exportDailyProgressExcel();
    } else {
        exportLeaderboardExcel();
    }
}

function switchAdminWorkspaceTab(tab) {
    const viewSelect = document.getElementById('adminViewSelector');
    const lbPanel = document.getElementById('adminTabPanelLeaderboard');
    const dailyPanel = document.getElementById('adminTabPanelDaily');
    const filterDrawer = document.getElementById('adminFilterDrawer');
    const copiedPanel = document.getElementById('adminTabPanelCopied');
    const topCtrlLb = document.getElementById('adminTopCtrlLeaderboard');
    const topCtrlCopied = document.getElementById('adminTopCtrlCopied');

    const normalizedTab = (tab === 'daily') ? 'leaderboard' : tab;
    if (viewSelect && viewSelect.value !== normalizedTab) {
        viewSelect.value = normalizedTab;
    }

    if (lbPanel) lbPanel.classList.add('hidden');
    if (dailyPanel) dailyPanel.classList.add('hidden');
    if (filterDrawer) filterDrawer.classList.add('hidden');
    if (copiedPanel) copiedPanel.classList.add('hidden');
    if (topCtrlLb) {
        topCtrlLb.classList.add('hidden');
        topCtrlLb.classList.remove('flex');
    }
    if (topCtrlCopied) {
        topCtrlCopied.classList.add('hidden');
        topCtrlCopied.classList.remove('flex');
    }

    if (tab === 'daily') {
        if (topCtrlLb) {
            topCtrlLb.classList.remove('hidden');
            topCtrlLb.classList.add('flex');
        }
        setDailyReportDateOffset(0);
    } else if (tab === 'filter') {
        if (filterDrawer) filterDrawer.classList.remove('hidden');
        updateAdminFilterMatchCount();
    } else if (tab === 'copied') {
        if (copiedPanel) copiedPanel.classList.remove('hidden');
        if (topCtrlCopied) {
            topCtrlCopied.classList.remove('hidden');
            topCtrlCopied.classList.add('flex');
        }
        loadCopiedFamilyReport();
    } else {
        if (topCtrlLb) {
            topCtrlLb.classList.remove('hidden');
            topCtrlLb.classList.add('flex');
        }
        if (districtProgressMode === 'date') {
            if (dailyPanel) dailyPanel.classList.remove('hidden');
        } else {
            if (lbPanel) lbPanel.classList.remove('hidden');
        }
        updateDistrictProgressModeButtons();
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
    const rows = document.querySelectorAll('#leaderboardTableBody tr, #dailyProgressTableBody tr');
    rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        if (!q || text.includes(q)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
}

function sortLeaderboardTable(col) {
    if (leaderboardSortState.col === col) {
        leaderboardSortState.asc = !leaderboardSortState.asc;
    } else {
        leaderboardSortState.col = col;
        leaderboardSortState.asc = (col === 'block');
    }
    renderLeaderboardRows();
    updateSortIcons('leaderboardTable', leaderboardSortState);
}

function renderLeaderboardRows() {
    const tbody = document.getElementById('leaderboardTableBody');
    if (!tbody) return;

    if (!cachedLeaderboard || cachedLeaderboard.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">No records found.</td></tr>`;
        return;
    }

    let rows = [...cachedLeaderboard];
    if (leaderboardSortState.col) {
        const { col, asc } = leaderboardSortState;
        rows.sort((a, b) => {
            let valA, valB;
            switch (col) {
                case 'block':
                    valA = String(a.block_name || '');
                    valB = String(b.block_name || '');
                    return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'families':
                    valA = Number(a.total_families || 0);
                    valB = Number(b.total_families || 0);
                    break;
                case 'members':
                    valA = Number(a.total_members || 0);
                    valB = Number(b.total_members || 0);
                    break;
                case 'approved':
                    valA = Number(a.approved_members || 0);
                    valB = Number(b.approved_members || 0);
                    break;
                case 'pending':
                    valA = Number(a.pending_members || 0);
                    valB = Number(b.pending_members || 0);
                    break;
                case 'not_applied':
                    valA = Number(a.not_applied_members || 0) + Number(a.unidentified_members || 0);
                    valB = Number(b.not_applied_members || 0) + Number(b.unidentified_members || 0);
                    break;
                case 'no_record':
                    valA = Number(a.no_record_members || 0);
                    valB = Number(b.no_record_members || 0);
                    break;
                case 'not_traceable':
                    valA = Number(a.not_traceable_members || 0);
                    valB = Number(b.not_traceable_members || 0);
                    break;
                case 'extra':
                    valA = Number(a.extra_added_members || 0);
                    valB = Number(b.extra_added_members || 0);
                    break;
                case 'pct':
                    valA = Number(a.total_members || 0) > 0 ? (Number(a.approved_members || 0) / Number(a.total_members || 0)) : 0;
                    valB = Number(b.total_members || 0) > 0 ? (Number(b.approved_members || 0) / Number(b.total_members || 0)) : 0;
                    break;
                default:
                    return 0;
            }
            return asc ? (valA - valB) : (valB - valA);
        });
    }

    tbody.innerHTML = '';
    rows.forEach((row, i) => {
        const tM = Number(row.total_members || 0);
        const tF = Number(row.total_families || 0);
        const appM = Number(row.approved_members || 0);
        const pendM = Number(row.pending_members || 0);
        const naM = Number(row.not_applied_members || 0) + Number(row.unidentified_members || 0);
        const noRecM = Number(row.no_record_members || 0);
        const trM = Number(row.not_traceable_members || 0);
        const exM = Number(row.extra_added_members || 0);
        const pct = tM > 0 ? ((appM / tM) * 100).toFixed(1) : '0.0';

        let rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">${i + 1}</span>`;
        if (i === 0) rankBadge = `<span class="text-base" title="Rank 1">🥇</span>`;
        else if (i === 1) rankBadge = `<span class="text-base" title="Rank 2">🥈</span>`;
        else if (i === 2) rankBadge = `<span class="text-base" title="Rank 3">🥉</span>`;

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

    const searchInput = document.getElementById('leaderboardSearchInput');
    if (searchInput && searchInput.value) {
        filterLeaderboardRows(searchInput.value);
    }
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
    const targetDate = getIstDateString(offsetDays);
    const fromInput = document.getElementById('dailyProgressFromDate');
    const toInput = document.getElementById('dailyProgressToDate');
    if (fromInput) fromInput.value = targetDate;
    if (toInput) toInput.value = targetDate;
    setDistrictProgressMode('date');
    loadDailyProgressReport();
}

async function loadAdminLeaderboard() {
    if (!isMasterAdmin()) {
        return;
    }

    const todayStr = getIstDateString(0);
    const fromInput = document.getElementById('dailyProgressFromDate');
    const toInput = document.getElementById('dailyProgressToDate');
    if (fromInput && !fromInput.value) fromInput.value = todayStr;
    if (toInput && !toInput.value) toInput.value = todayStr;

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

    try {
        const { data, error } = await supabaseClient.rpc('get_block_leaderboard');
        if (error) throw error;

        cachedLeaderboard = data || [];
        if (cachedLeaderboard.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">No records found.</td></tr>`;
            return;
        }

        let distM = 0, distF = 0, distApp = 0, distPend = 0, distNoRec = 0, distTr = 0, distNA = 0, distExtra = 0;

        cachedLeaderboard.forEach((row) => {
            const tM = Number(row.total_members || 0);
            const tF = Number(row.total_families || 0);
            const appM = Number(row.approved_members || 0);
            const pendM = Number(row.pending_members || 0);
            const naM = Number(row.not_applied_members || 0) + Number(row.unidentified_members || 0);
            const noRecM = Number(row.no_record_members || 0);
            const trM = Number(row.not_traceable_members || 0);
            const exM = Number(row.extra_added_members || 0);

            distM += tM; distF += tF; distApp += appM; distPend += pendM;
            distNoRec += noRecM; distTr += trM; distNA += naM; distExtra += exM;
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

        renderLeaderboardRows();
        updateSortIcons('leaderboardTable', leaderboardSortState);

        await loadDailyProgressReport();
        const activeView = document.getElementById('adminViewSelector');
        if (activeView && activeView.value === 'copied') {
            await loadCopiedFamilyReport();
        }
    } catch (err) {
        console.error("Leaderboard error:", err);
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-rose-600 font-semibold">Error: ${err.message}</td></tr>`;
        showToast(`Leaderboard Error: ${err.message}`, 'error');
    }
}

async function loadDailyProgressReport() {
    if (!isMasterAdmin()) return;

    const todayStr = getIstDateString(0);
    const fromInput = document.getElementById('dailyProgressFromDate');
    const toInput = document.getElementById('dailyProgressToDate');
    if (fromInput && !fromInput.value) fromInput.value = todayStr;
    if (toInput && !toInput.value) toInput.value = todayStr;

    let fromDate = (fromInput && fromInput.value) ? fromInput.value : todayStr;
    let toDate = (toInput && toInput.value) ? toInput.value : fromDate;

    if (fromDate > toDate) {
        const temp = fromDate;
        fromDate = toDate;
        toDate = temp;
        if (fromInput) fromInput.value = fromDate;
        if (toInput) toInput.value = toDate;
    }

    const isSingleDay = fromDate === toDate;
    const periodLabel = isSingleDay ? fromDate : `${fromDate} to ${toDate}`;
    currentDailyReportDate = isSingleDay ? fromDate : `${fromDate}_to_${toDate}`;

    const tbody = document.getElementById('dailyProgressTableBody');
    const subtitle = document.getElementById('dailyReportSubtitle');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Scanning block-wise card approvals for <b>${periodLabel}</b> (IST)...</td></tr>`;
    }
    if (subtitle) {
        subtitle.innerText = isSingleDay
            ? `Showing card approvals & field updates recorded on ${fromDate} (IST).`
            : `Showing card approvals & field updates recorded from ${fromDate} to ${toDate} (IST).`;
    }

    try {
        if (!cachedLeaderboard || cachedLeaderboard.length === 0) {
            const lbRes = await supabaseClient.rpc('get_block_leaderboard');
            if (!lbRes.error && lbRes.data) {
                cachedLeaderboard = lbRes.data;
            }
        }

        const startIso = new Date(`${fromDate}T00:00:00.000+05:30`).toISOString();
        const endIso = new Date(`${toDate}T23:59:59.999+05:30`).toISOString();

        // Fetch all records updated in the selected date range in 1,000-row pages
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
                    daily_pending: 0,
                    daily_excluded: 0,
                    daily_total_processed: 0,
                    families_set: new Set(),
                    cumulative_approved: 0,
                    base_total: 0
                });
            }

            const entry = blockStatsMap.get(blk);
            const famId = String(r.family_id ?? '');

            entry.daily_total_processed += 1;
            if (famId) {
                entry.families_set.add(famId);
                districtFamiliesSet.add(famId);
            }

            if (statusVal === 'Approved') {
                entry.daily_approved_total += 1;
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
        let totalDayPending = 0;
        let totalDayProcessed = 0;
        let activeBlocksCount = 0;
        let zeroApprovedBlocksCount = 0;

        sortedBlocks.forEach(b => {
            totalDayApproved += b.daily_approved_total;
            totalDayPending += b.daily_pending;
            totalDayProcessed += b.daily_total_processed;
            if (b.daily_total_processed > 0) activeBlocksCount += 1;
            if (b.daily_approved_total === 0) zeroApprovedBlocksCount += 1;
        });

        document.getElementById('dailyStatApproved').innerText = totalDayApproved.toLocaleString();
        document.getElementById('dailyStatPending').innerText = totalDayPending.toLocaleString();
        document.getElementById('dailyStatProcessed').innerText = totalDayProcessed.toLocaleString();
        document.getElementById('dailyStatFamilies').innerText = `${districtFamiliesSet.size.toLocaleString()} Fam`;
        document.getElementById('dailyStatActiveBlocks').innerText = `${activeBlocksCount}/${sortedBlocks.length}`;
        document.getElementById('dailyStatZeroBlocks').innerText = `${zeroApprovedBlocksCount} with 0 App`;

        const quickBadge = document.getElementById('dailyTabQuickBadge');
        if (quickBadge) {
            const isToday = isSingleDay && fromDate === todayStr;
            const labelPrefix = isToday ? 'Today' : periodLabel;
            quickBadge.innerText = `${labelPrefix}: +${totalDayApproved.toLocaleString()} Approved`;
        }

        renderDailyProgressRows();
        updateSortIcons('dailyProgressTable', dailyProgressSortState);
        updateDistrictProgressModeButtons();
    } catch (err) {
        console.error("Daily progress report error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-600 font-semibold">Error loading daily progress: ${err.message}</td></tr>`;
        }
    }
}

function getDailyStatusScore(r) {
    if (r.daily_approved_total >= 25) return 4;
    if (r.daily_approved_total > 0) return 3;
    if (r.daily_total_processed > 0) return 2;
    return 1;
}

function sortDailyProgressTable(col) {
    if (dailyProgressSortState.col === col) {
        dailyProgressSortState.asc = !dailyProgressSortState.asc;
    } else {
        dailyProgressSortState.col = col;
        dailyProgressSortState.asc = (col === 'block');
    }
    renderDailyProgressRows();
    updateSortIcons('dailyProgressTable', dailyProgressSortState);
}

function renderDailyProgressRows() {
    const tbody = document.getElementById('dailyProgressTableBody');
    if (!tbody) return;

    if (!cachedDailyProgress || cachedDailyProgress.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">No records found.</td></tr>`;
        return;
    }

    let rows = [...cachedDailyProgress];
    if (dailyProgressSortState.col) {
        const { col, asc } = dailyProgressSortState;
        rows.sort((a, b) => {
            let valA, valB;
            switch (col) {
                case 'block':
                    valA = String(a.block_name || '');
                    valB = String(b.block_name || '');
                    return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'approved':
                    valA = Number(a.daily_approved_total || 0);
                    valB = Number(b.daily_approved_total || 0);
                    break;
                case 'pending':
                    valA = Number(a.daily_pending || 0);
                    valB = Number(b.daily_pending || 0);
                    break;
                case 'excluded':
                    valA = Number(a.daily_excluded || 0);
                    valB = Number(b.daily_excluded || 0);
                    break;
                case 'total':
                    valA = Number(a.daily_total_processed || 0);
                    valB = Number(b.daily_total_processed || 0);
                    break;
                case 'families':
                    valA = Number(a.daily_families || 0);
                    valB = Number(b.daily_families || 0);
                    break;
                case 'cum_pct':
                    valA = a.base_total > 0 ? (a.cumulative_approved / a.base_total) : 0;
                    valB = b.base_total > 0 ? (b.cumulative_approved / b.base_total) : 0;
                    break;
                case 'status':
                    valA = getDailyStatusScore(a);
                    valB = getDailyStatusScore(b);
                    break;
                default:
                    return 0;
            }
            return asc ? (valA - valB) : (valB - valA);
        });
    }

    tbody.innerHTML = '';
    rows.forEach((row, idx) => {
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
            <td class="p-3.5 text-right font-mono font-semibold text-amber-600">${row.daily_pending.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono font-semibold text-rose-600">${row.daily_excluded.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono font-bold text-slate-800">${row.daily_total_processed.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono text-slate-600">${row.daily_families.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono text-sm font-bold text-emerald-800">${cumPct}%</td>
            <td class="p-3.5 text-center">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    const searchInput = document.getElementById('leaderboardSearchInput');
    if (searchInput && searchInput.value) {
        filterLeaderboardRows(searchInput.value);
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

    if (gpCacheByBlock && gpCacheByBlock.has(block)) {
        const data = gpCacheByBlock.get(block);
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
        await updateAdminFilterMatchCount();
        return;
    }

    gpSelect.innerHTML = `<option value="ALL">Loading GPs for ${block}...</option>`;
    try {
        const { data, error } = await supabaseClient.rpc('get_block_gps', { p_block: block });
        if (error) throw error;

        if (gpCacheByBlock) gpCacheByBlock.set(block, data || []);
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

        const recentRows = [];
        const chunkSize = 1000;
        let offset = 0;

        while (true) {
            const { data, error } = await supabaseClient
                .from('bocw_members')
                .select('block_name, family_id, STATUS, updated_at')
                .neq('STATUS', 'Not Applied')
                .gte('updated_at', since)
                .order('updated_at', { ascending: false })
                .order('member_id', { ascending: true })
                .range(offset, offset + chunkSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            recentRows.push(...data);
            if (data.length < chunkSize) break;
            offset += chunkSize;
        }

        const minuteBuckets = {};
        recentRows.forEach(r => {
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

function filterCopiedReportRows(query) {
    const q = (query || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#copiedReportTableBody tr');
    rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        const fids = (tr.getAttribute('data-family-ids') || '').toLowerCase();
        tr.style.display = (!q || text.includes(q) || fids.includes(q)) ? '' : 'none';
    });
    return;
    rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        if (!q || text.includes(q)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
}

async function loadCopiedFamilyReport() {
    if (!isMasterAdmin()) return;

    const blockSelect = document.getElementById('copiedReportBlockSelector');
    const block = (blockSelect && blockSelect.value) ? blockSelect.value : '';
    const tbody = document.getElementById('copiedReportTableBody');
    const subtitle = document.getElementById('copiedReportSubtitle');

    if (!block) {
        if (subtitle) {
            subtitle.innerText = "Please select a Block from the dropdown above to view GP-wise report.";
        }
        const statGPs = document.getElementById('copiedStatGPs');
        const statFam = document.getElementById('copiedStatFamilies');
        const statProc = document.getElementById('copiedStatProcessed');
        const statUnproc = document.getElementById('copiedStatUnprocessed');
        if (statGPs) statGPs.innerText = '--';
        if (statFam) statFam.innerText = '--';
        if (statProc) statProc.innerText = '--';
        if (statUnproc) statUnproc.innerText = '--';

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-10 text-center text-slate-500">
                        <p class="font-bold text-slate-700">Please select a Block from the dropdown above.</p>
                        <p class="text-xs text-slate-400 mt-1">Choose a specific Block or "ALL 22 BLOCKS" to view unique Family IDs copied by DEOs.</p>
                    </td>
                </tr>
            `;
        }
        cachedCopiedReport = { gpRows: [], familyRows: [], blockScope: '' };
        return;
    }

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">Scanning GP-wise unique copied Family IDs for <b>${block === 'ALL' ? 'All 22 Blocks' : block}</b>...</td></tr>`;
    }
    if (subtitle) {
        subtitle.innerText = block === 'ALL'
            ? 'Showing Gram Panchayats across all 22 Blocks where DEOs have copied Family IDs.'
            : `Showing all Gram Panchayats in ${block} with unique Family IDs copied by DEO.`;
    }

    try {
        const rows = [];
        const chunkSize = 1000;
        let offset = 0;

        while (true) {
            let query = supabaseClient
                .from('bocw_members')
                .select('block_name, gram_panchayat_name, family_id, member_id, mobile_no, STATUS, remark, updated_at')
                .not('member_id', 'ilike', 'EXTRA_%');

            if (block === 'ALL') {
                query = query.ilike('remark', '%[COPIED%');
            } else {
                query = query.eq('block_name', block);
            }

            const { data, error } = await query
                .order('member_id', { ascending: true })
                .range(offset, offset + chunkSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            rows.push(...data);
            if (data.length < chunkSize) break;
            offset += chunkSize;
        }

        // Group by Block + GP -> Family ID
        const gpMap = new Map();
        const copiedFamilyMap = new Map();

        rows.forEach(r => {
            if (String(r.member_id ?? '').startsWith('EXTRA_')) return;
            const blk = String(r.block_name ?? '').trim() || 'UNKNOWN';
            const gp = String(r.gram_panchayat_name ?? 'UNKNOWN').trim() || 'UNKNOWN';
            const famId = String(r.family_id ?? '').trim();
            if (!famId) return;

            const gpKey = `${blk}__${gp}`;
            if (!gpMap.has(gpKey)) {
                gpMap.set(gpKey, {
                    block_name: blk,
                    gp_name: gp,
                    all_families: new Set(),
                    copied_families: new Map(), // famId -> { hasProcessed: boolean, statuses: Set }
                    latest_timestamp: null
                });
            }

            const gpEntry = gpMap.get(gpKey);
            gpEntry.all_families.add(famId);

            const statusVal = cleanStatus(r.STATUS);
            const isProcessed = statusVal !== 'Not Applied';
            const copied = isRecordCopied(r.remark);

            if (copied) {
                if (!gpEntry.copied_families.has(famId)) {
                    gpEntry.copied_families.set(famId, {
                        family_id: famId,
                        block_name: blk,
                        gp_name: gp,
                        mobile_no: String(r.mobile_no ?? ''),
                        total_members: 0,
                        processed_members: 0,
                        not_processed_members: 0,
                        has_processed: false,
                        latest_timestamp: r.updated_at || null
                    });
                }
                const famObj = gpEntry.copied_families.get(famId);
                famObj.total_members += 1;
                if (isProcessed) {
                    famObj.processed_members += 1;
                    famObj.has_processed = true;
                } else {
                    famObj.not_processed_members += 1;
                }
                copiedFamilyMap.set(`${gpKey}__${famId}`, famObj);
                if (r.updated_at) {
                    if (!gpEntry.latest_timestamp || r.updated_at > gpEntry.latest_timestamp) {
                        gpEntry.latest_timestamp = r.updated_at;
                    }
                    if (!famObj.latest_timestamp || r.updated_at > famObj.latest_timestamp) {
                        famObj.latest_timestamp = r.updated_at;
                    }
                }
            }
        });

        const gpRows = Array.from(gpMap.values()).map(g => {
            const copiedFams = Array.from(g.copied_families.values());
            let copiedProcessed = 0;
            let copiedUnprocessed = 0;
            copiedFams.forEach(f => {
                if (f.has_processed) copiedProcessed += 1;
                else copiedUnprocessed += 1;
            });
            return {
                block_name: g.block_name,
                gp_name: g.gp_name,
                total_families: g.all_families.size,
                copied_count: copiedFams.length,
                copied_processed: copiedProcessed,
                copied_unprocessed: copiedUnprocessed,
                latest_timestamp: g.latest_timestamp,
                copied_family_ids: copiedFams.map(f => f.family_id).sort()
            };
        }).sort((a, b) => {
            if (b.copied_count !== a.copied_count) return b.copied_count - a.copied_count;
            const blkCmp = a.block_name.localeCompare(b.block_name);
            if (blkCmp !== 0) return blkCmp;
            return a.gp_name.localeCompare(b.gp_name);
        });

        const familyRows = Array.from(copiedFamilyMap.values()).sort((a, b) => {
            const blkCmp = a.block_name.localeCompare(b.block_name);
            if (blkCmp !== 0) return blkCmp;
            const gpCmp = a.gp_name.localeCompare(b.gp_name);
            if (gpCmp !== 0) return gpCmp;
            return a.family_id.localeCompare(b.family_id);
        });

        cachedCopiedReport = {
            gpRows,
            familyRows,
            blockScope: block
        };

        let totalCopiedFams = 0;
        let totalCopiedProc = 0;
        let totalCopiedUnproc = 0;
        gpRows.forEach(r => {
            totalCopiedFams += r.copied_count;
            totalCopiedProc += r.copied_processed;
            totalCopiedUnproc += r.copied_unprocessed;
        });

        document.getElementById('copiedStatGPs').innerText = gpRows.length.toLocaleString();
        document.getElementById('copiedStatFamilies').innerText = totalCopiedFams.toLocaleString();
        document.getElementById('copiedStatProcessed').innerText = totalCopiedProc.toLocaleString();
        document.getElementById('copiedStatUnprocessed').innerText = totalCopiedUnproc.toLocaleString();

        renderCopiedReportRows();
        updateSortIcons('copiedReportTable', copiedReportSortState);
    } catch (err) {
        console.error("Copied Family ID report error:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-rose-600 font-semibold">Error loading report: ${err.message}</td></tr>`;
        }
    }
}

function sortCopiedReportTable(col) {
    if (copiedReportSortState.col === col) {
        copiedReportSortState.asc = !copiedReportSortState.asc;
    } else {
        copiedReportSortState.col = col;
        copiedReportSortState.asc = (col === 'block' || col === 'gp');
    }
    renderCopiedReportRows();
    updateSortIcons('copiedReportTable', copiedReportSortState);
}

function renderCopiedReportRows() {
    const tbody = document.getElementById('copiedReportTableBody');
    if (!tbody) return;

    if (!cachedCopiedReport || !cachedCopiedReport.gpRows || cachedCopiedReport.gpRows.length === 0) {
        const block = (document.getElementById('copiedReportBlockSelector') || {}).value || '';
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-10 text-center text-slate-500">
                    <p class="font-bold text-slate-700">${block ? `No copied Family IDs recorded yet for ${block === 'ALL' ? 'any block' : block}.` : 'Please select a Block from the dropdown above.'}</p>
                    <p class="text-xs text-slate-400 mt-1">${block ? 'Select a specific Block from the dropdown above to see all its GPs, or click "📋 Family ID (Copy)" in the DEO Terminal.' : 'Choose a specific Block or "ALL 22 BLOCKS" to view unique Family IDs copied by DEOs.'}</p>
                </td>
            </tr>
        `;
        return;
    }

    let rows = [...cachedCopiedReport.gpRows];
    if (copiedReportSortState.col) {
        const { col, asc } = copiedReportSortState;
        rows.sort((a, b) => {
            let valA, valB;
            switch (col) {
                case 'block':
                    valA = String(a.block_name || '');
                    valB = String(b.block_name || '');
                    return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'gp':
                    valA = String(a.gp_name || '');
                    valB = String(b.gp_name || '');
                    return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'total_families':
                    valA = Number(a.total_families || 0);
                    valB = Number(b.total_families || 0);
                    break;
                case 'copied':
                    valA = Number(a.copied_count || 0);
                    valB = Number(b.copied_count || 0);
                    break;
                case 'processed':
                    valA = Number(a.copied_processed || 0);
                    valB = Number(b.copied_processed || 0);
                    break;
                case 'unprocessed':
                    valA = Number(a.copied_unprocessed || 0);
                    valB = Number(b.copied_unprocessed || 0);
                    break;
                case 'timestamp':
                    valA = (a.latest_timestamp && !isNaN(new Date(a.latest_timestamp).getTime())) ? new Date(a.latest_timestamp).getTime() : 0;
                    valB = (b.latest_timestamp && !isNaN(new Date(b.latest_timestamp).getTime())) ? new Date(b.latest_timestamp).getTime() : 0;
                    break;
                default:
                    return 0;
            }
            return asc ? (valA - valB) : (valB - valA);
        });
    }

    tbody.innerHTML = '';
    rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = row.copied_count > 0
            ? "bg-indigo-50/20 hover:bg-indigo-50/70 cursor-pointer transition"
            : "hover:bg-slate-50 cursor-pointer transition";
        tr.title = `Click to open ${row.block_name} -> ${row.gp_name} in DEO Terminal`;
        tr.setAttribute('data-family-ids', (row.copied_family_ids || []).join(' '));
        tr.onclick = async () => {
            if (!isMasterAdmin()) return;
            document.getElementById('blockSelector').value = row.block_name;
            document.getElementById('statusFilter').value = 'ALL';
            document.getElementById('searchInput').value = '';
            switchRole('deo');
            currentPage = 1;
            await loadGPDropdown();
            document.getElementById('gpSelector').value = row.gp_name;
            await loadBlockData();
            showToast(`Opened ${row.gp_name} (${row.block_name})`, 'info', 2000);
        };

        const timeLabel = formatIstTimestampShort(row.latest_timestamp);

        tr.innerHTML = `
            <td class="p-3.5 font-bold text-slate-700 whitespace-nowrap">${idx + 1}. ${escapeHtml(row.block_name)}</td>
            <td class="p-3.5 font-bold text-slate-900">${escapeHtml(row.gp_name)}</td>
            <td class="p-3.5 text-right font-mono text-slate-600">${row.total_families.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono font-black text-base ${row.copied_count > 0 ? 'text-indigo-700' : 'text-slate-400'}">
                ${row.copied_count.toLocaleString()}
            </td>
            <td class="p-3.5 text-right font-mono font-bold text-emerald-700">${row.copied_processed.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono font-semibold text-amber-700">${row.copied_unprocessed.toLocaleString()}</td>
            <td class="p-3.5 text-right font-mono text-xs text-slate-500 whitespace-nowrap">${escapeHtml(timeLabel)}</td>
        `;
        tbody.appendChild(tr);
    });

    const searchInput = document.getElementById('copiedReportSearchInput');
    if (searchInput && searchInput.value) {
        filterCopiedReportRows(searchInput.value);
    }
}
