/**
 * ============================================================================
 * Main Application Controller & Navigation
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
    const saved = getSavedSession();
    if (saved) {
        currentSession = saved;
        await initializeAuthenticatedApp();
    } else {
        document.getElementById('appShell').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        setTimeout(() => {
            const u = document.getElementById('loginUsername');
            if (u) u.focus();
        }, 50);
    }
});

async function initializeAuthenticatedApp() {
    const session = getSavedSession();
    if (!session) return;

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    configureBlockSelectorForSession(session);

    if (session.role === 'admin') {
        document.getElementById('roleSelector').value = 'admin';
        document.getElementById('deoView').classList.add('hidden');
        document.getElementById('adminView').classList.remove('hidden');
        await Promise.all([
            loadAdminLeaderboard(),
            loadGPDropdown(),
            loadBlockData()
        ]);
    } else {
        document.getElementById('deoView').classList.remove('hidden');
        document.getElementById('adminView').classList.add('hidden');
        await Promise.all([
            loadGPDropdown(),
            loadBlockData()
        ]);
    }
}

function switchRole(role) {
    if (role === 'admin' && !isMasterAdmin()) {
        return;
    }

    document.getElementById('roleSelector').value = role;
    if (role === 'admin') {
        document.getElementById('deoView').classList.add('hidden');
        document.getElementById('adminView').classList.remove('hidden');
        loadAdminLeaderboard();
    } else {
        document.getElementById('adminView').classList.add('hidden');
        document.getElementById('deoView').classList.remove('hidden');
    }
}

async function onBlockChange() {
    const block = getAuthorizedBlock();
    if (!block) return;

    document.getElementById('activeBlockTitle').innerText = `${block} Block Terminal`;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.classList.add('hidden');

    currentPage = 1;
    await Promise.all([
        loadGPDropdown(),
        loadBlockData()
    ]);
}

function resetPageAndLoad() {
    currentPage = 1;
    loadBlockData();
}

function changePage(direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    loadBlockData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
