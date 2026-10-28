/**
 * ============================================================================
 * ACMO District Command View - Leaderboard & Velocity Audit
 * ============================================================================
 */

async function loadAdminLeaderboard() {
    const tbody = document.getElementById('leaderboardTableBody');
    tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">Calculating real-time stats across all 70,673 records...</td></tr>`;

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

            const tr = document.createElement('tr');
            tr.className = "hover:bg-indigo-50/50 cursor-pointer transition";
            tr.onclick = () => {
                document.getElementById('blockSelector').value = row.block_name;
                switchRole('deo');
                onBlockChange();
            };

            tr.innerHTML = `
                <td class="p-3.5 font-bold text-slate-900">${i + 1}. ${row.block_name}</td>
                <td class="p-3.5 text-right font-mono text-slate-600">${tF.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-slate-800">${tM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-bold text-emerald-700">${appM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-amber-600">${pendM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-slate-700">${naM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-purple-600">${noRecM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-semibold text-rose-600">${trM.toLocaleString()}</td>
                <td class="p-3.5 text-right font-mono font-bold text-indigo-700">+${exM.toLocaleString()}</td>
                <td class="p-3.5">
                    <div class="flex items-center gap-2">
                        <div class="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div class="bg-emerald-500 h-full" style="width: ${Math.min(100, pct)}%"></div>
                        </div>
                        <span class="text-xs font-bold text-slate-800">${pct}%</span>
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

    } catch (err) {
        console.error("Leaderboard error:", err);
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-rose-600 font-semibold">Error: ${err.message}</td></tr>`;
    }
}

async function checkSpeedAnomalies() {
    const banner = document.getElementById('antiCheatBanner');
    banner.classList.remove('hidden');
    banner.className = "mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 text-xs font-semibold";
    banner.innerText = "Scanning recent update timestamps across blocks for velocity anomalies (>6 families/minute)...";

    try {
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
            banner.className = "mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-bold";
            banner.innerText = "✓ Velocity Audit Passed: No bulk-clicking anomalies (>6 families/min) detected in the last 24 hours.";
        } else {
            banner.className = "mb-4 p-4 rounded-xl border bg-rose-50 border-rose-300 text-rose-800 text-xs font-bold space-y-1";
            banner.innerHTML = `<p>⚠️ Speed Anomaly Detected (>6 families updated in a single minute):</p><p class="font-mono text-[11px]">${anomalies.join(' | ')}</p>`;
        }
    } catch (err) {
        banner.innerText = `Velocity audit error: ${err.message}`;
    }
}
