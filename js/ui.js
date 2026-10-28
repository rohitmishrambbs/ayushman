/**
 * ============================================================================
 * UI Rendering, Formatting & Modal Helpers
 * ============================================================================
 */

function cleanStatus(raw) {
    if (!raw || raw === 'NULL' || raw === 'Unidentified' || String(raw).trim() === '') {
        return 'Not Applied';
    }
    return String(raw).trim();
}

function getBadgeHtml(statusVal) {
    if (statusVal === 'Approved') {
        return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Approved</span>`;
    }
    if (statusVal === 'Portal Pending') {
        return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Portal Pending</span>`;
    }
    if (statusVal === 'No Record Found') {
        return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">No Record Found</span>`;
    }
    if (statusVal === 'Not Traceable') {
        return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Not Traceable</span>`;
    }
    return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">Not Applied</span>`;
}

function renderFamilyGroups(records, totalCount) {
    const container = document.getElementById('familyListContainer');
    const countLabel = document.getElementById('recordCount');

    if (!records || records.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-slate-500 text-sm font-semibold">No matching records found for this filter.</div>`;
        countLabel.innerText = "0 Members";
        return;
    }

    const familiesMap = new Map();
    records.forEach(rec => {
        const famId = String(rec.family_id ?? 'UNKNOWN');
        if (!familiesMap.has(famId)) {
            familiesMap.set(famId, {
                family_id: famId,
                block_name: String(rec.block_name ?? ''),
                gp_name: String(rec.gram_panchayat_name ?? 'N/A'),
                mobile_no: String(rec.mobile_no ?? 'N/A'),
                members: []
            });
        }
        familiesMap.get(famId).members.push(rec);
    });

    countLabel.innerText = `Showing ${records.length} of ${totalCount.toLocaleString()} Members (${familiesMap.size} Families on Page ${currentPage})`;
    container.innerHTML = '';

    familiesMap.forEach(fam => {
        const cleanPhone = fam.mobile_no.replace(/\D/g, '');
        const safeGp = fam.gp_name.replace(/'/g, "\\'");
        const safeMob = fam.mobile_no.replace(/'/g, "\\'");

        const membersHtml = fam.members.map((m, idx) => {
            const memId = String(m.member_id ?? '');
            const isExtra = memId.startsWith('EXTRA_');
            const memName = String(m.member_name ?? 'Unknown');
            const fatherName = String(m.father_name ?? '');
            const memType = String(m.type ?? '');
            const gender = String(m.gender ?? '');
            const birthYear = String(m.birth_year ?? '');
            const dob = String(m.date_of_birth ?? '');
            const statusVal = cleanStatus(m.STATUS);
            const remark = m.remark || '';
            const isWorker = memType.toLowerCase().includes('worker');

            // Clean header display: if extra member, only show Name + Added badge + Card Status
            const demographicLine = isExtra
                ? `<p class="text-xs text-indigo-600 font-medium pl-5">Added from PM-JAY Portal &bull; Member ID: <span class="italic text-slate-400">Blank</span></p>`
                : `<p class="text-xs text-slate-500 pl-5">Father/Spouse: <span class="font-semibold text-slate-800">${fatherName || 'N/A'}</span> &bull; DOB: ${dob || 'N/A'} &bull; <span class="font-mono text-[11px] text-slate-400">ID: ${memId}</span></p>`;

            const titleFormatted = isExtra
                ? `<span class="font-bold text-slate-900 text-sm">${memName}</span>
                   <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">✨ Added Member</span>`
                : `<span class="font-bold text-slate-900 text-sm">${memName} ${gender ? `(${gender})` : ''} ${birthYear}</span>
                   <span class="text-[11px] font-bold px-2 py-0.5 rounded ${isWorker ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}">${memType || 'Member'}</span>`;

            const deleteBtnHtml = isExtra
                ? `<button onclick="deleteExtraMember('${memId}', '${memName.replace(/'/g, "\\'")}')" title="Remove mistakenly added member" class="px-2 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition ml-1">🗑️</button>`
                : '';

            return `
                <div class="py-2.5 px-3.5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 ${isExtra ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200'} rounded-lg border hover:border-slate-300 transition">
                    <div class="space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-mono text-slate-400 font-bold">${idx + 1}.</span>
                            ${titleFormatted}
                            ${getBadgeHtml(statusVal)}
                        </div>
                        ${demographicLine}
                        ${remark ? `<p class="text-xs text-rose-600 font-bold pl-5 mt-0.5">↳ Reason: ${remark}</p>` : ''}
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 self-end lg:self-center shrink-0">
                        <button onclick="toggleMemberStatus('${memId}', 'Approved')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition ${statusVal === 'Approved' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-300'}">Approved</button>
                        <button onclick="toggleMemberStatus('${memId}', 'Portal Pending')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition ${statusVal === 'Portal Pending' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white hover:bg-amber-50 text-amber-700 border-slate-300'}">Portal Pending</button>
                        <button onclick="toggleMemberStatus('${memId}', 'Not Applied')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition ${statusVal === 'Not Applied' ? 'bg-slate-700 text-white border-slate-800 shadow-sm' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}">Not Applied</button>
                        <button onclick="toggleMemberStatus('${memId}', 'No Record Found')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition ${statusVal === 'No Record Found' ? 'bg-purple-600 text-white border-purple-700 shadow-sm' : 'bg-white hover:bg-purple-50 text-purple-700 border-slate-300'}">No Record Found</button>
                        <button onclick="handleNotTraceableClick('member', '${memId}', '${statusVal}')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition ${statusVal === 'Not Traceable' ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-white hover:bg-rose-50 text-rose-700 border-slate-300'}">Not Traceable</button>
                        ${deleteBtnHtml}
                    </div>
                </div>
            `;
        }).join('');

        const cardHtml = `
            <div class="p-5 bg-slate-50/70 hover:bg-slate-50 transition space-y-3">
                <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                    <div class="flex flex-wrap items-center gap-2.5">
                        <button onclick="copyFamilyId('${fam.family_id}', this)" title="Click to copy Family ID" class="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-lg shadow-sm font-mono font-bold text-xs transition cursor-pointer">
                            <span>📋</span>
                            <span>Family ID: ${fam.family_id}</span>
                        </button>

                        <a href="tel:${cleanPhone}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm text-xs font-bold transition">
                            <span>📞</span>
                            <span class="font-mono">${fam.mobile_no}</span>
                            <span class="text-[10px] font-normal opacity-90">(Dial)</span>
                        </a>

                        <span class="bg-slate-200/80 text-slate-800 border border-slate-300 text-xs font-bold px-2.5 py-1 rounded-lg">GP: ${fam.gp_name}</span>

                        <!-- + Add Member Button -->
                        <button onclick="openAddMemberModal('${fam.family_id}', '${fam.block_name}', '${safeGp}', '${safeMob}')" class="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer">
                            <span>＋</span>
                            <span>Add Member</span>
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[11px] font-bold text-slate-500 uppercase mr-1">Whole Family (${fam.members.length}):</span>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'Approved')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 transition">Approve All</button>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'Portal Pending')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-300 transition">Pending All</button>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'Not Applied')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white border border-slate-300 transition">Not Applied All</button>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'No Record Found')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-800 hover:text-white border border-purple-300 transition">No Record All</button>
                        <button onclick="handleNotTraceableClick('family', '${fam.family_id}', '')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-800 hover:text-white border border-rose-300 transition">Not Traceable All</button>
                    </div>
                </div>

                <div class="space-y-2 pl-0 sm:pl-3 border-l-2 border-slate-300">
                    ${membersHtml}
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function updatePaginationControls(totalCount) {
    const maxPage = Math.ceil(totalCount / pageSize) || 1;
    document.getElementById('pageIndicator').innerText = `Page ${currentPage} of ${maxPage} (${totalCount.toLocaleString()} members)`;
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= maxPage;
}

function copyFamilyId(famId, btnEl) {
    navigator.clipboard.writeText(famId);
    const originalHtml = btnEl.innerHTML;
    btnEl.innerHTML = `<span class="text-emerald-700 font-bold">✓ Copied: ${famId}</span>`;
    btnEl.classList.remove('bg-white', 'border-slate-300');
    btnEl.classList.add('bg-emerald-50', 'border-emerald-500');
    setTimeout(() => {
        btnEl.innerHTML = originalHtml;
        btnEl.classList.remove('bg-emerald-50', 'border-emerald-500');
        btnEl.classList.add('bg-white', 'border-slate-300');
    }, 1000);
}

// Modal Open/Close Helpers
function openAddMemberModal(familyId, blockName, gpName, mobileNo) {
    const activeBlock = blockName || document.getElementById('blockSelector').value;
    pendingAddFamilyContext = {
        family_id: String(familyId),
        block_name: String(activeBlock),
        gp_name: String(gpName),
        mobile_no: String(mobileNo)
    };
    document.getElementById('addModalFamilyLabel').innerText = `Family ID: ${familyId} • GP: ${gpName}`;
    document.getElementById('newMemberName').value = '';
    document.getElementById('newMemberStatus').value = 'Approved';
    document.getElementById('addMemberModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('newMemberName').focus(), 50);
}

function closeAddMemberModal() {
    pendingAddFamilyContext = null;
    document.getElementById('addMemberModal').classList.add('hidden');
}

function closeReasonModal() {
    pendingTraceableTarget = null;
    document.getElementById('reasonModal').classList.add('hidden');
}
