/**
 * ============================================================================
 * UI Rendering, Formatting, Toasts & Modal Helpers
 * ============================================================================
 */

// Toast Notification Manager
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-animated pointer-events-auto flex items-center gap-3 p-3.5 rounded-xl border shadow-xl text-xs font-bold transition-all duration-300`;

    let icon = 'ℹ️';
    let styleClasses = 'bg-slate-900 text-white border-slate-800 shadow-slate-900/30';

    if (type === 'success') {
        icon = '✓';
        styleClasses = 'bg-emerald-700 text-white border-emerald-600 shadow-emerald-700/30';
    } else if (type === 'warning') {
        icon = '⚠️';
        styleClasses = 'bg-amber-600 text-white border-amber-500 shadow-amber-600/30';
    } else if (type === 'error') {
        icon = '✕';
        styleClasses = 'bg-rose-700 text-white border-rose-600 shadow-rose-700/30';
    }

    toast.className += ` ${styleClasses}`;
    toast.innerHTML = `
        <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold">${icon}</span>
        <span class="flex-1 leading-snug">${message}</span>
        <button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white text-sm font-bold ml-1">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function cleanStatus(raw) {
    if (!raw || raw === 'NULL' || raw === 'Unidentified' || String(raw).trim() === '') {
        return 'Not Applied';
    }
    return String(raw).trim();
}

function getBadgeHtml(statusVal) {
    if (statusVal === 'Approved') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Approved
        </span>`;
    }
    if (statusVal === 'Portal Pending') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Portal Pending
        </span>`;
    }
    if (statusVal === 'No Record Found') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-600"></span> No Record
        </span>`;
    }
    if (statusVal === 'Not Traceable') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Not Traceable
        </span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Not Applied
    </span>`;
}

function renderFamilyGroups(records, totalCount) {
    const container = document.getElementById('familyListContainer');
    const countLabel = document.getElementById('recordCount');

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="p-12 text-center text-slate-500 text-sm font-semibold flex flex-col items-center justify-center gap-2">
                <span class="text-3xl">🔍</span>
                <p class="text-slate-700 font-bold">No matching records found</p>
                <p class="text-xs text-slate-400 font-normal">Try adjusting your search terms or filters to find beneficiaries.</p>
            </div>
        `;
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
            const gender = String(m.gender ?? '').toUpperCase();
            const birthYear = String(m.birth_year ?? '');
            const dob = String(m.date_of_birth ?? '');
            const statusVal = cleanStatus(m.STATUS);
            const remark = m.remark || '';
            const isWorker = memType.toLowerCase().includes('worker');

            // Gender icon helper
            let genderIcon = '👤';
            if (gender === 'M' || gender === 'MALE') genderIcon = '👨';
            else if (gender === 'F' || gender === 'FEMALE') genderIcon = '👩';

            // Clean demographic line
            const demographicLine = isExtra
                ? `<p class="text-xs text-indigo-600 font-medium pl-6">Added from PM-JAY Portal &bull; Member ID: <span class="italic text-slate-400">Blank</span></p>`
                : `<p class="text-xs text-slate-500 pl-6 flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span>Father/Spouse: <strong class="font-semibold text-slate-800">${fatherName || 'N/A'}</strong></span>
                    <span>&bull;</span>
                    <span>DOB: <span class="text-slate-700 font-medium">${dob || 'N/A'}</span></span>
                    <span>&bull;</span>
                    <span class="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">ID: ${memId}</span>
                   </p>`;

            const titleFormatted = isExtra
                ? `<span class="font-bold text-slate-900 text-sm">${memName}</span>
                   <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">✨ Added Member</span>`
                : `<span class="font-bold text-slate-900 text-sm">${memName}</span>
                   <span class="text-xs text-slate-500">${genderIcon} ${birthYear ? `(${birthYear})` : ''}</span>
                   <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${isWorker ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}">${memType || 'Member'}</span>`;

            const deleteBtnHtml = isExtra
                ? `<button onclick="deleteExtraMember('${memId}', '${memName.replace(/'/g, "\\'")}')" title="Remove mistakenly added member" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition ml-1 cursor-pointer">🗑️ Delete</button>`
                : '';

            // Border color depending on status
            let borderAccent = 'border-slate-200';
            if (statusVal === 'Approved') borderAccent = 'border-l-4 border-l-emerald-500 border-slate-200';
            else if (statusVal === 'Portal Pending') borderAccent = 'border-l-4 border-l-amber-500 border-slate-200';
            else if (statusVal === 'No Record Found') borderAccent = 'border-l-4 border-l-purple-500 border-slate-200';
            else if (statusVal === 'Not Traceable') borderAccent = 'border-l-4 border-l-rose-500 border-slate-200';

            return `
                <div class="member-row py-2.5 px-3.5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 ${isExtra ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white'} rounded-xl border ${borderAccent} shadow-2xs">
                    <div class="space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
                            ${titleFormatted}
                            ${getBadgeHtml(statusVal)}
                        </div>
                        ${demographicLine}
                        ${remark ? `<div class="pl-6 mt-1"><span class="inline-flex items-center gap-1 text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">↳ Reason: ${remark}</span></div>` : ''}
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 self-end lg:self-center shrink-0">
                        <button onclick="toggleMemberStatus('${memId}', 'Approved')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${statusVal === 'Approved' ? 'bg-emerald-600 text-white border-emerald-700 status-btn-active-approved' : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-300'}">✓ Approved</button>
                        <button onclick="toggleMemberStatus('${memId}', 'Portal Pending')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${statusVal === 'Portal Pending' ? 'bg-amber-500 text-white border-amber-600 status-btn-active-pending' : 'bg-white hover:bg-amber-50 text-amber-700 border-slate-300'}">⏳ Pending</button>
                        <button onclick="toggleMemberStatus('${memId}', 'Not Applied')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${statusVal === 'Not Applied' ? 'bg-slate-700 text-white border-slate-800 status-btn-active-not-applied' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}">⚪ Not Applied</button>
                        <button onclick="toggleMemberStatus('${memId}', 'No Record Found')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${statusVal === 'No Record Found' ? 'bg-purple-600 text-white border-purple-700 status-btn-active-no-record' : 'bg-white hover:bg-purple-50 text-purple-700 border-slate-300'}">❓ No Record</button>
                        <button onclick="handleNotTraceableClick('member', '${memId}', '${statusVal}')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${statusVal === 'Not Traceable' ? 'bg-rose-600 text-white border-rose-700 status-btn-active-not-traceable' : 'bg-white hover:bg-rose-50 text-rose-700 border-slate-300'}">✕ Not Traceable</button>
                        ${deleteBtnHtml}
                    </div>
                </div>
            `;
        }).join('');

        const cardHtml = `
            <div class="family-card p-5 bg-white hover:bg-slate-50/50 transition duration-150 space-y-3.5 border-b border-slate-200">
                <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Copy Family ID Button -->
                        <button onclick="copyFamilyId('${fam.family_id}', this)" title="Click to copy Family ID to clipboard" class="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 hover:text-indigo-700 border border-slate-300 rounded-xl shadow-2xs font-mono font-bold text-xs transition cursor-pointer">
                            <span class="group-hover:scale-110 transition-transform">📋</span>
                            <span>Family ID: ${fam.family_id}</span>
                            <span class="text-[10px] text-slate-400 group-hover:text-indigo-500 font-sans font-normal">(Copy)</span>
                        </button>

                        <!-- Dial Mobile Phone -->
                        <a href="tel:${cleanPhone}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs text-xs font-bold transition hover:shadow-emerald-600/30">
                            <span>📞</span>
                            <span class="font-mono">${fam.mobile_no}</span>
                            <span class="text-[10px] opacity-90 font-sans font-normal">(Call)</span>
                        </a>

                        <!-- GP Badge -->
                        <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl">
                            <span>📍</span>
                            <span>GP: ${fam.gp_name}</span>
                        </span>

                        <!-- + Add Member Button -->
                        <button onclick="openAddMemberModal('${fam.family_id}', '${fam.block_name}', '${safeGp}', '${safeMob}')" class="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-indigo-600/30 transition cursor-pointer active:scale-95">
                            <span>＋</span>
                            <span>Add Member</span>
                        </button>
                    </div>

                    <!-- Whole Family Action Bar -->
                    <div class="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <span class="text-[11px] font-bold text-slate-500 uppercase px-1.5">Whole Family (${fam.members.length}):</span>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'Approved')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 transition cursor-pointer">Approve All</button>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'Portal Pending')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-300 transition cursor-pointer">Pending All</button>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'Not Applied')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-white hover:bg-slate-700 text-slate-700 hover:text-white border border-slate-300 transition cursor-pointer">Not Applied All</button>
                        <button onclick="toggleFamilyStatus('${fam.family_id}', 'No Record Found')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-800 hover:text-white border border-purple-300 transition cursor-pointer">No Record All</button>
                        <button onclick="handleNotTraceableClick('family', '${fam.family_id}', '')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-800 hover:text-white border border-rose-300 transition cursor-pointer">Not Traceable All</button>
                    </div>
                </div>

                <div class="space-y-2 pl-0 sm:pl-3 border-l-2 border-indigo-200">
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
    btnEl.innerHTML = `<span class="text-emerald-700 font-bold flex items-center gap-1">✓ Copied: ${famId}</span>`;
    btnEl.classList.remove('bg-slate-50', 'border-slate-300');
    btnEl.classList.add('bg-emerald-50', 'border-emerald-500');
    showToast(`Copied Family ID: ${famId}`, 'success', 2000);
    setTimeout(() => {
        btnEl.innerHTML = originalHtml;
        btnEl.classList.remove('bg-emerald-50', 'border-emerald-500');
        btnEl.classList.add('bg-slate-50', 'border-slate-300');
    }, 1200);
}

// Search Clear Helpers
function toggleSearchClearButton(inputEl) {
    const clearBtn = document.getElementById('clearSearchBtn');
    if (!clearBtn) return;
    if (inputEl.value.trim().length > 0) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
}

function clearSearchInput() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    resetPageAndLoad();
}

// Modal Open/Close Helpers
function openAddMemberModal(familyId, blockName, gpName, mobileNo) {
    const activeBlock = getAuthorizedBlock() || blockName;
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
    setTimeout(() => document.getElementById('newMemberName').focus(), 60);
}

function closeAddMemberModal() {
    pendingAddFamilyContext = null;
    document.getElementById('addMemberModal').classList.add('hidden');
}

function closeReasonModal() {
    pendingTraceableTarget = null;
    document.getElementById('reasonModal').classList.add('hidden');
}

// Global Keyboard Shortcuts (Escape to close modals)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const addModal = document.getElementById('addMemberModal');
        const reasonModal = document.getElementById('reasonModal');
        if (addModal && !addModal.classList.contains('hidden')) {
            closeAddMemberModal();
        }
        if (reasonModal && !reasonModal.classList.contains('hidden')) {
            closeReasonModal();
        }
    }
});

// Scroll to top button visibility
window.addEventListener('scroll', () => {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    if (!scrollBtn) return;
    if (window.scrollY > 400) {
        scrollBtn.classList.add('visible');
    } else {
        scrollBtn.classList.remove('visible');
    }
});
