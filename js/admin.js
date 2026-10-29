/**
 * ============================================================================
 * ACMO District Command View - Leaderboard & Velocity Audit
 * ============================================================================
 */

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

async function loadAdminLeaderboard() {
    if (!isMasterAdmin()) {
        return;
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
                <td class="p-3.5 text-right font-mono font-semibold text-purple-700">${noRecM.toLocaleString()}</td>
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
        document.getElementById('statTotalFamilies').innerText = `${distF.toLocaleString()} Families • ${cachedLeaderboard.length} Blocks`;
        document.getElementById('statApproved').innerText = distApp.toLocaleString();
        document.getElementById('statApprovedPct').innerText = `${distPct}% Completion (${(distM - distNA).toLocaleString()} Processed)`;
        document.getElementById('statPending').innerText = distPend.toLocaleString();
        document.getElementById('statNotApplied').innerText = distNA.toLocaleString();
        document.getElementById('statOther').innerText = (distNoRec + distTr).toLocaleString();
        document.getElementById('statExtraAdded').innerText = `+${distExtra.toLocaleString()}`;

        // Re-apply block search filter if user had typed something
        const searchInput = document.getElementById('leaderboardSearchInput');
        if (searchInput && searchInput.value) {
            filterLeaderboardRows(searchInput.value);
        }

    } catch (err) {
        console.error("Leaderboard error:", err);
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-rose-600 font-semibold">Error: ${err.message}</td></tr>`;
        showToast(`Leaderboard Error: ${err.message}`, 'error');
    }
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
            banner.className = "mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-bold animate-fade-in";
            banner.innerHTML = `<span class="text-sm mr-1">✓</span> Velocity Audit Passed: No bulk-clicking anomalies (>6 families/min) detected in the last 24 hours.`;
            showToast("Velocity Audit: No anomalies detected", "success", 2500);
        } else {
            banner.className = "mb-4 p-4 rounded-xl border bg-rose-50 border-rose-300 text-rose-800 text-xs font-bold space-y-1 animate-fade-in";
            banner.innerHTML = `<p class="flex items-center gap-1.5"><span class="text-sm">⚠️</span> Speed Anomaly Detected (>6 families updated in a single minute):</p><p class="font-mono text-[11px] bg-rose-100/60 p-2 rounded-lg mt-1">${anomalies.join(' | ')}</p>`;
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
