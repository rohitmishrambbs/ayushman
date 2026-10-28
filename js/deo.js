/**
 * ============================================================================
 * Block DEO Terminal - Data Fetching & Status Mutations
 * ============================================================================
 */

async function loadGPDropdown() {
    const block = getAuthorizedBlock();
    if (!block) return;
    const gpSelect = document.getElementById('gpSelector');
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
}

async function loadBlockData() {
    const block = getAuthorizedBlock();
    if (!block) return;

    document.getElementById('activeBlockTitle').innerText = `${block} Block Terminal`;

    const gp = document.getElementById('gpSelector').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.trim();
    const container = document.getElementById('familyListContainer');
    const statusText = document.getElementById('syncStatusText');

    try {
        statusText.innerText = "Fetching Cloud Data...";
        container.innerHTML = `<div class="p-10 text-center text-slate-400 text-sm">Loading records for <b>${block}</b>...</div>`;

        let query = supabaseClient
            .from('bocw_members')
            .select('*', { count: 'exact' })
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
        statusText.innerText = "Synced with Cloud DB";
    } catch (err) {
        console.error("Database fetch error:", err);
        container.innerHTML = `<div class="p-8 text-center text-rose-600 text-sm font-bold">Database Query Error: ${err.message}</div>`;
        statusText.innerText = "Query Error";
    }
}

async function updateBlockSummaryBar(block) {
    const authorizedBlock = getAuthorizedBlock() || block;
    const bar = document.getElementById('blockSummaryBar');
    try {
        const { data, error } = await supabaseClient.rpc('get_block_leaderboard');
        if (error || !data) return;

        const row = data.find(r => r.block_name === authorizedBlock);
        if (!row) return;

        const notAppliedTotal = Number(row.not_applied_members || 0) + Number(row.unidentified_members || 0);
        const extraTotal = Number(row.extra_added_members || 0);

        bar.innerHTML = `
            <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span class="block text-slate-500 font-bold uppercase text-[10px]">Base Total</span>
                <span class="font-black text-slate-900 text-sm">${Number(row.total_members || 0).toLocaleString()} <span class="font-normal text-xs text-slate-500">(${Number(row.total_families || 0).toLocaleString()} Fam)</span></span>
            </div>
            <div class="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <span class="block text-emerald-700 font-bold uppercase text-[10px]">Approved</span>
                <span class="font-black text-emerald-900 text-sm">${Number(row.approved_members || 0).toLocaleString()}</span>
            </div>
            <div class="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <span class="block text-amber-700 font-bold uppercase text-[10px]">Portal Pending</span>
                <span class="font-black text-amber-900 text-sm">${Number(row.pending_members || 0).toLocaleString()}</span>
            </div>
            <div class="bg-slate-100 p-2.5 rounded-lg border border-slate-300">
                <span class="block text-slate-700 font-bold uppercase text-[10px]">Not Applied</span>
                <span class="font-black text-slate-900 text-sm">${notAppliedTotal.toLocaleString()}</span>
            </div>
            <div class="bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                <span class="block text-purple-700 font-bold uppercase text-[10px]">No Record Found</span>
                <span class="font-black text-purple-900 text-sm">${Number(row.no_record_members || 0).toLocaleString()}</span>
            </div>
            <div class="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <span class="block text-rose-700 font-bold uppercase text-[10px]">Not Traceable</span>
                <span class="font-black text-rose-900 text-sm">${Number(row.not_traceable_members || 0).toLocaleString()}</span>
            </div>
            <div class="bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                <span class="block text-indigo-700 font-bold uppercase text-[10px]">+ Extra Added</span>
                <span class="font-black text-indigo-900 text-sm">${extraTotal.toLocaleString()}</span>
            </div>
        `;
    } catch (e) {
        console.error("Summary bar error:", e);
    }
}

async function confirmAddMember() {
    if (!pendingAddFamilyContext) return;
    const block = getAuthorizedBlock();
    if (!block) return;

    const nameInput = document.getElementById('newMemberName').value.trim().toUpperCase();
    const statusInput = document.getElementById('newMemberStatus').value;
    const saveBtn = document.getElementById('saveNewMemberBtn');
    const statusText = document.getElementById('syncStatusText');

    if (!nameInput) {
        alert("Please enter the Member Name.");
        return;
    }

    // Internal unique key masked as blank on UI & Excel
    const internalKey = `EXTRA_${pendingAddFamilyContext.family_id}_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;

    const newRecord = {
        family_id: pendingAddFamilyContext.family_id,
        member_id: internalKey,
        block_name: block,
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
        updateBlockSummaryBar(block);
        statusText.innerText = `Added ${nameInput}`;
    } catch (err) {
        alert(`Could not add member: ${err.message}`);
        statusText.innerText = "Add Failed";
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "+ Save Member to Family";
    }
}

async function deleteExtraMember(internalMemberId, memberName) {
    if (!String(internalMemberId).startsWith('EXTRA_')) return;
    const block = getAuthorizedBlock();
    if (!block) return;
    if (!confirm(`Remove added member "${memberName}" from this family?`)) return;

    const statusText = document.getElementById('syncStatusText');
    try {
        statusText.innerText = "Removing...";
        const { error } = await supabaseClient
            .from('bocw_members')
            .delete()
            .eq('member_id', String(internalMemberId))
            .eq('block_name', block);

        if (error) throw error;

        currentLoadedRecords = currentLoadedRecords.filter(r => String(r.member_id) !== String(internalMemberId));
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(block);
        statusText.innerText = "Removed Extra Member";
    } catch (err) {
        alert(`Failed to remove member: ${err.message}`);
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
    const block = getAuthorizedBlock();
    if (!block) return;
    const statusText = document.getElementById('syncStatusText');
    try {
        statusText.innerText = `Saving...`;
        let { error } = await supabaseClient
            .from('bocw_members')
            .update({
                STATUS: status,
                remark: remark,
                updated_at: new Date().toISOString()
            })
            .eq('member_id', String(memberId))
            .eq('block_name', block);

        if (error) {
            const fallback = await supabaseClient
                .from('bocw_members')
                .update({ STATUS: status })
                .eq('member_id', String(memberId))
                .eq('block_name', block);
            if (fallback.error) throw fallback.error;
        }

        const rec = currentLoadedRecords.find(r => String(r.member_id) === String(memberId));
        if (rec) {
            rec.STATUS = status;
            rec.remark = remark;
        }

        statusText.innerText = `Saved Status`;
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(block);
    } catch (err) {
        alert(`Failed to save status: ${err.message}`);
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
    const block = getAuthorizedBlock();
    if (!block) return;
    const statusText = document.getElementById('syncStatusText');
    try {
        statusText.innerText = `Updating Family ${familyId}...`;
        let { error } = await supabaseClient
            .from('bocw_members')
            .update({
                STATUS: status,
                remark: remark,
                updated_at: new Date().toISOString()
            })
            .eq('family_id', String(familyId))
            .eq('block_name', block);

        if (error) {
            const fallback = await supabaseClient
                .from('bocw_members')
                .update({ STATUS: status })
                .eq('family_id', String(familyId))
                .eq('block_name', block);
            if (fallback.error) throw fallback.error;
        }

        currentLoadedRecords.forEach(r => {
            if (String(r.family_id) === String(familyId)) {
                r.STATUS = status;
                r.remark = remark;
            }
        });

        statusText.innerText = `Saved Family ${familyId}`;
        renderFamilyGroups(currentLoadedRecords, currentLoadedRecords.length);
        updateBlockSummaryBar(block);
    } catch (err) {
        alert(`Failed to update Family: ${err.message}`);
        statusText.innerText = "Save Failed";
    }
}
