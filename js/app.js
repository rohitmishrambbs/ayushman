/**
 * ============================================================================
 * Main Application Controller & Navigation
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
    await loadGPDropdown();
    await loadBlockData();
});

function switchRole(role) {
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
    const block = document.getElementById('blockSelector').value;
    document.getElementById('activeBlockTitle').innerText = `${block} Block Terminal`;
    document.getElementById('searchInput').value = '';
    currentPage = 1;
    await loadGPDropdown();
    await loadBlockData();
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
