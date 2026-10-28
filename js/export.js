/**
 * ============================================================================
 * Native .xlsx Excel Exports (Masks EXTRA_ as Blank Member ID)
 * ============================================================================
 */

async function exportCampCallListExcel() {
    const block = document.getElementById('blockSelector').value;
    const gp = document.getElementById('gpSelector').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const statusText = document.getElementById('syncStatusText');

    try {
        statusText.innerText = "Generating Excel (.xlsx)...";
        let query = supabaseClient
            .from('bocw_members')
            .select('*')
            .eq('block_name', block);

        if (gp !== 'ALL') {
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

        const { data, error } = await query
            .order('gram_panchayat_name', { ascending: true })
            .order('family_id', { ascending: true })
            .order('member_id', { ascending: true })
            .limit(10000);

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("No records found for export.");
            statusText.innerText = "Synced with Cloud DB";
            return;
        }

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
        const statusLabel = statusFilter === 'ALL' ? 'AllStatuses' : statusFilter.replace(/\s+/g, '');
        XLSX.writeFile(wb, `BoCW_${block}_${gp}_${statusLabel}.xlsx`);
        statusText.innerText = "Excel Exported";
    } catch (err) {
        console.error("Excel export error:", err);
        alert(`Export failed: ${err.message}`);
        statusText.innerText = "Export Error";
    }
}

function exportLeaderboardExcel() {
    if (!cachedLeaderboard || cachedLeaderboard.length === 0) {
        alert("Wait for the leaderboard to finish loading first.");
        return;
    }

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
}
