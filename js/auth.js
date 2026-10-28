/**
 * ============================================================================
 * Authentication & Role-Based Access Control (Supabase RPC + localStorage)
 * ============================================================================
 */

const AUTH_STORAGE_KEY = 'bocw_azamgarh_auth_session_v1';

const ALL_BLOCKS_META = [
    { name: "MOHAMMADPUR", label: "MOHAMMADPUR (3,542)" },
    { name: "AHIRAULA", label: "AHIRAULA (4,093)" },
    { name: "LALGANJ", label: "LALGANJ (4,028)" },
    { name: "MIRZAPUR", label: "MIRZAPUR (4,027)" },
    { name: "PAWAI", label: "PAWAI (3,940)" },
    { name: "THEKMA", label: "THEKMA (3,844)" },
    { name: "AZMATGARH", label: "AZMATGARH (3,734)" },
    { name: "PHULPUR", label: "PHULPUR (3,440)" },
    { name: "TAHBARPUR", label: "TAHBARPUR (3,281)" },
    { name: "MAHRAJGANJ", label: "MAHRAJGANJ (3,271)" },
    { name: "KOILSA", label: "KOILSA (3,202)" },
    { name: "RANI KI SARAI", label: "RANI KI SARAI (3,147)" },
    { name: "TARWA", label: "TARWA (3,128)" },
    { name: "MARTINGANJ", label: "MARTINGANJ (3,105)" },
    { name: "SATHIYAON", label: "SATHIYAON (3,058)" },
    { name: "HARAIYA", label: "HARAIYA (2,859)" },
    { name: "MEHNAGAR", label: "MEHNAGAR (2,844)" },
    { name: "BILARIYAGANJ", label: "BILARIYAGANJ (2,779)" },
    { name: "PALHANI", label: "PALHANI (2,595)" },
    { name: "ATRAULIA", label: "ATRAULIA (2,405)" },
    { name: "JAHANAGANJ", label: "JAHANAGANJ (2,334)" },
    { name: "PALHANA", label: "PALHANA (2,017)" }
];

function getSavedSession() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.username || !parsed.role) return null;
        if (parsed.role === 'deo' && !parsed.assigned_block) return null;
        return parsed;
    } catch (e) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
}

function isMasterAdmin() {
    const session = getSavedSession();
    return Boolean(session && session.role === 'admin');
}

function getAuthorizedBlock() {
    const session = getSavedSession();
    if (!session) return null;
    if (session.role === 'deo') {
        return session.assigned_block;
    }
    const selector = document.getElementById('blockSelector');
    return selector ? selector.value : 'MOHAMMADPUR';
}

async function handleLoginSubmit(event) {
    if (event) event.preventDefault();

    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorBox = document.getElementById('loginErrorBox');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const submitText = document.getElementById('loginSubmitText');

    const username = (usernameInput.value || '').trim().toUpperCase();
    const password = (passwordInput.value || '').trim();

    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    if (!username || !password) {
        errorBox.innerText = 'Please enter both User ID and Password.';
        errorBox.classList.remove('hidden');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitText.innerText = 'Verifying Credentials...';

        const { data, error } = await supabaseClient.rpc('authenticate_portal_user', {
            p_username: username,
            p_password: password
        });

        if (error) {
            throw error;
        }

        const userRow = Array.isArray(data) ? data[0] : data;

        if (!userRow || !userRow.username) {
            errorBox.innerText = 'Invalid User ID or Password. Please check your credentials.';
            errorBox.classList.remove('hidden');
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }

        const sessionData = {
            username: String(userRow.username),
            role: String(userRow.role), // 'admin' or 'deo'
            assigned_block: userRow.assigned_block ? String(userRow.assigned_block) : null,
            display_name: String(userRow.display_name || userRow.username),
            logged_in_at: new Date().toISOString()
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
        currentSession = sessionData;
        passwordInput.value = '';

        await initializeAuthenticatedApp();
    } catch (err) {
        console.error('Login error:', err);
        errorBox.innerText = `Authentication Error: ${err.message || 'Unable to verify credentials on Supabase.'}`;
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitText.innerText = 'Sign In to Portal';
    }
}

function logoutPortalUser() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    currentSession = null;
    currentLoadedRecords = [];
    cachedLeaderboard = [];
    currentPage = 1;

    document.getElementById('familyListContainer').innerHTML = '';
    document.getElementById('leaderboardTableBody').innerHTML = '';
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');

    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorBox = document.getElementById('loginErrorBox');
    if (errorBox) errorBox.classList.add('hidden');
    if (passwordInput) passwordInput.value = '';
    if (usernameInput) usernameInput.focus();
}

function configureBlockSelectorForSession(session) {
    const blockSelector = document.getElementById('blockSelector');
    const modeSwitcher = document.getElementById('modeSwitcherContainer');
    const userBadge = document.getElementById('loggedInUserBadge');

    if (session.role === 'deo') {
        const blockMeta = ALL_BLOCKS_META.find(b => b.name === session.assigned_block) || {
            name: session.assigned_block,
            label: session.assigned_block
        };
        blockSelector.innerHTML = `<option value="${blockMeta.name}" selected>🔒 ${blockMeta.label}</option>`;
        blockSelector.disabled = true;
        blockSelector.classList.add('opacity-80', 'cursor-not-allowed');

        if (modeSwitcher) modeSwitcher.classList.add('hidden');
        if (userBadge) {
            userBadge.innerHTML = `<span>🔒 DEO: ${session.assigned_block}</span>`;
        }
    } else {
        // Master Admin (ACMO) - Populate all 22 blocks
        const previousVal = blockSelector.value || 'MOHAMMADPUR';
        blockSelector.innerHTML = ALL_BLOCKS_META.map(b =>
            `<option value="${b.name}" ${b.name === previousVal ? 'selected' : ''}>${b.label}</option>`
        ).join('');
        blockSelector.disabled = false;
        blockSelector.classList.remove('opacity-80', 'cursor-not-allowed');

        if (modeSwitcher) modeSwitcher.classList.remove('hidden');
        if (userBadge) {
            userBadge.innerHTML = `<span>🛡️ ACMO MASTER</span>`;
        }
    }
}

function togglePasswordVisibility() {
    const pwdInput = document.getElementById('loginPassword');
    const eyeIcon = document.getElementById('passwordEyeLabel');
    if (!pwdInput) return;
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (eyeIcon) eyeIcon.innerText = 'Hide';
    } else {
        pwdInput.type = 'password';
        if (eyeIcon) eyeIcon.innerText = 'Show';
    }
}
