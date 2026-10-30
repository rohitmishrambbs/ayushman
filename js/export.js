/**
 * ============================================================================
 * Native .xlsx Excel Exports (Chunked Pagination for District-Scale Exports)
 * ============================================================================
 */

let isExportInProgress = false;

function applyExportFiltersToQuery(query, { block, gp, statusFilter, searchQuery }) {
    if (block && block !== 'ALL') {
        query = query.eq('block_name', block);
    }

    if (gp && gp !== 'ALL' && block !== 'ALL') {
        query = query.eq('gram_panchayat_name', gp);
    }

    if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'EXTRA_ONLY') {
            query = query.ilike('member_id', 'EXTRA_%');
        } else if (statusFilter === 'Not Applied') {
            query = query.or('STATUS.is.null,STATUS.eq.Not Applied,STATUS.eq.Unidentified,STATUS.eq.NULL,STATUS.eq.');
        } else {
            query = query.eq('STATUS', statusFilter);
        }
    }

    if (searchQuery && searchQuery.length > 0) {
        const q = searchQuery.replace(/,/g, '');
        query = query.or(`member_name.ilike.%${q}%,family_id.ilike.%${q}%,member_id.ilike.%${q}%,mobile_no.ilike.%${q}%,father_name.ilike.%${q}%`);
    }

    return query;
}

/**
 * Fetches all matching rows across Supabase's 1,000-row PostgREST limit
 * using parallelized 1,000-row range chunks and sorts in-memory.
 */
async function fetchAllMatchingRecordsPaginated(filters, onProgress) {
    // 1. Get exact count first
    let countQuery = supabaseClient
        .from('bocw_members')
        .select('*', { count: 'exact', head: true });
    countQuery = applyExportFiltersToQuery(countQuery, filters);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    const totalCount = count || 0;
    if (totalCount === 0) return [];

    const chunkSize = 1000;
    const totalChunks = Math.ceil(totalCount / chunkSize);
    const concurrency = 3; // 3 parallel requests per wave for fast & safe throughput
    const allRows = [];

    for (let waveStart = 0; waveStart < totalChunks; waveStart += concurrency) {
        const wavePromises = [];
        for (let i = 0; i < concurrency && (waveStart + i) < totalChunks; i++) {
            const chunkIdx = waveStart + i;
            const fromIdx = chunkIdx * chunkSize;
            const toIdx = fromIdx + chunkSize - 1;

            let dataQuery = supabaseClient
                .from('bocw_members')
                .select('*');
            dataQuery = applyExportFiltersToQuery(dataQuery, filters);

            wavePromises.push(
                dataQuery
                    .order('member_id', { ascending: true })
                    .range(fromIdx, toIdx)
            );
        }

        const results = await Promise.all(wavePromises);
        for (const res of results) {
            if (res.error) throw res.error;
            if (res.data && res.data.length > 0) {
                allRows.push(...res.data);
            }
        }

        if (typeof onProgress === 'function') {
            onProgress(Math.min(allRows.length, totalCount), totalCount);
        }
    }

    // Fast in-memory sort: Block -> GP -> Family ID -> Member ID
    allRows.sort((a, b) => {
        const blkCmp = String(a.block_name ?? '').localeCompare(String(b.block_name ?? ''));
        if (blkCmp !== 0) return blkCmp;
        const gpCmp = String(a.gram_panchayat_name ?? '').localeCompare(String(b.gram_panchayat_name ?? ''));
        if (gpCmp !== 0) return gpCmp;
        const famCmp = String(a.family_id ?? '').localeCompare(String(b.family_id ?? ''));
        if (famCmp !== 0) return famCmp;
        return String(a.member_id ?? '').localeCompare(String(b.member_id ?? ''));
    });

    return allRows;
}

function generateMembersWorkbookAndDownload(data, fileName) {
    const headers = [
        "family_id",
        "member_id",
        "block_name",
        "gram_panchayat_name",
        "member_name",
        "father_name",
        "type",
        "gender",
        "date_of_birth",
        "birth_year",
        "mobile_no",
        "STATUS",
        "remark"
    ];

    const aoa = [headers];

    data.forEach(r => {
        const rawMemId = String(r.member_id ?? '');
        const isExtra = rawMemId.startsWith('EXTRA_');

        const famNum = Number(String(r.family_id ?? '').replace(/\D/g, ''));
        const memNum = isExtra ? NaN : Number(rawMemId.replace(/\D/g, ''));
        const byNum = Number(String(r.birth_year ?? '').replace(/\D/g, ''));
        const mobNum = Number(String(r.mobile_no ?? '').replace(/\D/g, ''));

        aoa.push([
            !isNaN(famNum) && famNum > 0 ? { t: 'n', v: famNum, z: '0' } : String(r.family_id ?? ''),
            isExtra ? "" : (!isNaN(memNum) && memNum > 0 ? { t: 'n', v: memNum, z: '0' } : rawMemId),
            String(r.block_name ?? ''),
            String(r.gram_panchayat_name ?? ''),
            String(r.member_name ?? ''),
            String(r.father_name ?? ''),
            String(r.type ?? ''),
            String(r.gender ?? ''),
            String(r.date_of_birth ?? ''),
            !isNaN(byNum) && byNum > 0 ? { t: 'n', v: byNum, z: '0' } : String(r.birth_year ?? ''),
            !isNaN(mobNum) && mobNum > 0 ? { t: 'n', v: mobNum, z: '0' } : String(r.mobile_no ?? ''),
            cleanStatus(r.STATUS),
            String(r.remark ?? '')
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
        { wch: 16 }, // family_id
        { wch: 18 }, // member_id (blank for added members)
        { wch: 16 }, // block_name
        { wch: 24 }, // gram_panchayat_name
        { wch: 22 }, // member_name
        { wch: 22 }, // father_name
        { wch: 14 }, // type
        { wch: 8 },  // gender
        { wch: 13 }, // date_of_birth
        { wch: 11 }, // birth_year
        { wch: 14 }, // mobile_no
        { wch: 16 }, // STATUS
        { wch: 32 }  // remark
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BoCW_List");
    XLSX.writeFile(wb, fileName);
}

async function exportCampCallListExcel() {
    if (isExportInProgress) return;

    const block = getAuthorizedBlock();
    if (!block) return;

    const gp = document.getElementById('gpSelector').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.trim();
    const statusText = document.getElementById('syncStatusText');
    const btnEl = document.getElementById('terminalExportBtn');
    const originalBtnHtml = btnEl ? btnEl.innerHTML : '<span>📥</span><span>Download List (.xlsx)</span>';

    try {
        isExportInProgress = true;
        if (btnEl) btnEl.disabled = true;
        statusText.innerText = "Preparing Excel (.xlsx)...";
        showToast("Preparing Excel file, please wait...", "info", 2000);

        const data = await fetchAllMatchingRecordsPaginated(
            { block, gp, statusFilter, searchQuery },
            (fetched, total) => {
                const pct = total > 0 ? Math.round((fetched / total) * 100) : 100;
                statusText.innerText = `Fetching ${fetched.toLocaleString()} / ${total.toLocaleString()} (${pct}%)...`;
                if (btnEl) {
                    btnEl.innerText = `⏳ ${fetched.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`;
                }
            }
        );

        if (!data || data.length === 0) {
            showToast("No records found for export.", "warning");
            statusText.innerText = "✓ Synced with Cloud DB";
            return;
        }

        if (btnEl) btnEl.innerText = `⚙️ Building .xlsx (${data.length.toLocaleString()} rows)...`;
        const blockLabel = block === 'ALL' ? 'ALL_22_BLOCKS' : block.replace(/\s+/g, '_');
        const gpLabel = gp === 'ALL' ? 'AllGPs' : gp.replace(/\s+/g, '_');
        const statusLabel = statusFilter === 'ALL' ? 'AllStatuses' : statusFilter.replace(/\s+/g, '');
        const filename = `BoCW_${blockLabel}_${gpLabel}_${statusLabel}.xlsx`;
        generateMembersWorkbookAndDownload(data, filename);

        statusText.innerText = `✓ Exported ${data.length.toLocaleString()} rows`;
        showToast(`Downloaded ${filename} (${data.length.toLocaleString()} rows)!`, "success", 3000);
    } catch (err) {
        console.error("Excel export error:", err);
        showToast(`Export failed: ${err.message}`, "error");
        statusText.innerText = "Export Error";
    } finally {
        isExportInProgress = false;
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalBtnHtml;
        }
    }
}

async function exportAdminFilteredExcel() {
    if (!isMasterAdmin()) {
        showToast("Access Denied: Only ACMO Master can export district-wide data.", "error");
        return;
    }
    if (isExportInProgress) return;

    const block = document.getElementById('adminBlockSelector').value;
    const gp = document.getElementById('adminGpSelector').value;
    const statusFilter = document.getElementById('adminStatusFilter').value;
    const searchQuery = document.getElementById('adminSearchInput').value.trim();

    const btnEl = document.getElementById('adminFilteredExportBtn');
    const badgeEl = document.getElementById('adminFilterCountBadge');
    const originalBtnHtml = btnEl ? btnEl.innerHTML : '📥 Download Filtered District Data (.xlsx)';

    try {
        isExportInProgress = true;
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerText = '⏳ Starting Export...';
        }
        showToast("Fetching filtered district data for Excel export...", "info", 2200);

        const data = await fetchAllMatchingRecordsPaginated(
            { block, gp, statusFilter, searchQuery },
            (fetched, total) => {
                const pct = total > 0 ? Math.round((fetched / total) * 100) : 100;
                if (btnEl) {
                    btnEl.innerText = `⏳ Fetching ${fetched.toLocaleString()} / ${total.toLocaleString()} (${pct}%)...`;
                }
                if (badgeEl) {
                    badgeEl.innerText = `Downloading: ${fetched.toLocaleString()} of ${total.toLocaleString()} Members (${pct}%)`;
                }
            }
        );

        if (!data || data.length === 0) {
            showToast("No matching records found for the selected filters.", "warning");
            await updateAdminFilterMatchCount();
            return;
        }

        if (btnEl) btnEl.innerText = `⚙️ Generating Excel (${data.length.toLocaleString()} rows)...`;

        const blockLabel = block === 'ALL' ? 'Azamgarh_All22Blocks' : `Block_${block.replace(/\s+/g, '_')}`;
        const gpLabel = (gp === 'ALL' || block === 'ALL') ? 'AllGPs' : gp.replace(/\s+/g, '_');
        const statusLabel = statusFilter === 'ALL' ? 'AllStatuses' : statusFilter.replace(/\s+/g, '');
        const searchSuffix = searchQuery ? `_Search_${searchQuery.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)}` : '';
        const filename = `BoCW_${blockLabel}_${gpLabel}_${statusLabel}${searchSuffix}.xlsx`;

        generateMembersWorkbookAndDownload(data, filename);

        if (badgeEl) {
            badgeEl.innerText = `✓ Exported ${data.length.toLocaleString()} Members to Excel (.xlsx)`;
        }
        showToast(`Downloaded ${filename} (${data.length.toLocaleString()} rows)!`, "success", 3000);
    } catch (err) {
        console.error("District filtered export error:", err);
        showToast(`District Export Failed: ${err.message}`, "error");
    } finally {
        isExportInProgress = false;
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalBtnHtml;
        }
    }
}

function exportLeaderboardExcel() {
    if (!isMasterAdmin()) {
        showToast("Access Denied: Only ACMO Master can export the 22-Block Leaderboard.", "error");
        return;
    }

    if (!cachedLeaderboard || cachedLeaderboard.length === 0) {
        showToast("Wait for the leaderboard to finish loading first.", "warning");
        return;
    }

    showToast("Generating Leaderboard Excel file...", "info", 1800);

    const headers = [
        "Rank",
        "Block_Name",
        "Total_Families",
        "Base_Members",
        "Approved",
        "Portal_Pending",
        "Not_Applied",
        "No_Record_Found",
        "Not_Traceable",
        "Extra_Added_Members",
        "Completion_Pct"
    ];

    const aoa = [headers];

    cachedLeaderboard.forEach((r, i) => {
        const tF = Number(r.total_families || 0);
        const tM = Number(r.total_members || 0);
        const appM = Number(r.approved_members || 0);
        const pendM = Number(r.pending_members || 0);
        const naM = Number(r.not_applied_members || 0) + Number(r.unidentified_members || 0);
        const noRecM = Number(r.no_record_members || 0);
        const trM = Number(r.not_traceable_members || 0);
        const exM = Number(r.extra_added_members || 0);
        const pct = tM > 0 ? Number(((appM / tM) * 100).toFixed(2)) : 0;

        aoa.push([
            { t: 'n', v: i + 1, z: '0' },
            String(r.block_name ?? ''),
            { t: 'n', v: tF, z: '0' },
            { t: 'n', v: tM, z: '0' },
            { t: 'n', v: appM, z: '0' },
            { t: 'n', v: pendM, z: '0' },
            { t: 'n', v: naM, z: '0' },
            { t: 'n', v: noRecM, z: '0' },
            { t: 'n', v: trM, z: '0' },
            { t: 'n', v: exM, z: '0' },
            { t: 'n', v: pct, z: '0.00' }
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 8 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 14 },
        { wch: 16 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "22_Block_Leaderboard");
    XLSX.writeFile(wb, "Azamgarh_BoCW_22Block_Leaderboard.xlsx");
    showToast("Downloaded 22-Block Leaderboard successfully!", "success", 3000);
}

function exportDailyProgressExcel() {
    if (!isMasterAdmin()) {
        showToast("Access Denied: Only ACMO Master can export the Daily Progress Report.", "error");
        return;
    }

    if (!cachedDailyProgress || cachedDailyProgress.length === 0) {
        showToast("Please wait for the Daily Progress Report to finish loading first.", "warning");
        return;
    }

    const reportDate = currentDailyReportDate || getIstDateString(0);

    const headers = [
        "Rank",
        "Period_IST",
        "Block_Name",
        "Approved",
        "Portal_Pending",
        "Excluded_NoRec_NotTraceable",
        "Total_Updated",
        "Families_Touched",
        "Cumulative_Approved_Pct"
    ];

    const aoa = [headers];

    cachedDailyProgress.forEach((r, i) => {
        const cumPct = r.base_total > 0 ? Number(((r.cumulative_approved / r.base_total) * 100).toFixed(2)) : 0;
        aoa.push([
            { t: 'n', v: i + 1, z: '0' },
            String(reportDate),
            String(r.block_name ?? ''),
            { t: 'n', v: Number(r.daily_approved_total || 0), z: '0' },
            { t: 'n', v: Number(r.daily_pending || 0), z: '0' },
            { t: 'n', v: Number(r.daily_excluded || 0), z: '0' },
            { t: 'n', v: Number(r.daily_total_processed || 0), z: '0' },
            { t: 'n', v: Number(r.daily_families || 0), z: '0' },
            `${cumPct}%`
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 8 },
        { wch: 24 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 28 },
        { wch: 16 },
        { wch: 18 },
        { wch: 24 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily_Progress_Report");
    const filename = `Azamgarh_BoCW_Daily_Progress_${reportDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Downloaded ${filename} successfully!`, "success", 3000);
}
