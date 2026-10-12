const App = {
    data: {
        profile: { name: '' },
        capsules: [],
        settings: {
            theme: 'light',
            demoMode: false,
            simulatedTime: null
        }
    },

    state: {
        currentImages: [],
        currentView: 'view-home',
        activeCapsuleId: null,
        countdownInterval: null,
        lastListRoute: 'view-dashboard'
    },

    // --- STORAGE ---
    loadData() {
        try {
            const saved = localStorage.getItem('timeCapsule_data');

            if (saved) {
                this.data = JSON.parse(saved);

                if (!this.data.capsules) {
                    this.data.capsules = [];
                }

                if (!this.data.profile) {
                    this.data.profile = { name: '' };
                }

                if (!this.data.settings) {
                    this.data.settings = {
                        theme: 'light',
                        demoMode: false,
                        simulatedTime: null
                    };
                }
            }
        } catch (e) {
            console.error("Error loading data", e);
        }
    },

    saveData() {
        try {
            localStorage.setItem(
                'timeCapsule_data',
                JSON.stringify(this.data)
            );
        } catch (e) {
            this.showToast(
                "Storage error. Storage might be full.",
                "error"
            );
        }
    },

    // --- TIME SYSTEM ---
    getNow() {
        if (
            this.data.settings.demoMode &&
            this.data.settings.simulatedTime
        ) {
            return new Date(this.data.settings.simulatedTime);
        }

        return new Date();
    },

    /*
     * Returns the status that should currently be DISPLAYED.
     *
     * IMPORTANT:
     * Demo Mode can visually unlock a capsule,
     * but it NEVER changes the saved capsule status.
     */
    getCapsuleDisplayStatus(capsule) {
        // Permanently broken seals remain broken.
        if (capsule.status === 'seal_broken') {
            return 'seal_broken';
        }

        // Permanently unlocked capsules remain unlocked.
        if (capsule.status === 'unlocked') {
            return 'unlocked';
        }

        // Demo Mode unlock is temporary and visual only.
        if (
            this.data.settings.demoMode &&
            capsule.status === 'sealed' &&
            new Date(this.getNow()) >= new Date(capsule.unlockAt)
        ) {
            return 'unlocked';
        }

        return 'sealed';
    },

    formatDate(dateStr) {
        const opts = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        return new Date(dateStr).toLocaleDateString(
            undefined,
            opts
        );
    },

    formatDateTime(dateStr) {
        const opts = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return new Date(dateStr).toLocaleString(
            undefined,
            opts
        );
    },

    // --- INITIALIZATION ---
    init() {
        this.loadData();
        this.applySettings();
        this.setupNavigation();
        this.setupCreateForm();

        // Greeting
        if (this.data.profile.name) {
            document.getElementById('nav-greeting').innerText =
                `Welcome back, ${this.data.profile.name}.`;

            document.getElementById('setting-name').value =
                this.data.profile.name;
        }

        // Initial Routing
        const hash = window.location.hash.replace('#', '');

        if (hash && document.getElementById(hash)) {
            this.navigateTo(hash);
        } else {
            this.navigateTo('view-home');
        }

        // Global time check
        setInterval(() => this.checkUnlocks(), 10000);

        this.checkUnlocks();
    },

    applySettings() {
        this.changeTheme(this.data.settings.theme);

        document.getElementById('setting-theme').value =
            this.data.settings.theme;

        if (
            this.data.settings.demoMode &&
            this.data.settings.simulatedTime
        ) {
            document.getElementById('setting-demo-time').value =
                this.data.settings.simulatedTime.slice(0, 16);

            this.updateDemoWidget();
        }
    },

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                const target =
                    link.getAttribute('data-target');

                if (target) {
                    this.navigateTo(target);
                }
            });
        });
    },

    // --- NAVIGATION ---
    navigateTo(viewId) {
        document.querySelectorAll('.view')
            .forEach(v => v.classList.remove('active'));

        document.querySelectorAll('.nav-link')
            .forEach(l => l.classList.remove('active'));

        const targetView =
            document.getElementById(viewId);

        if (targetView) {
            targetView.classList.add('active');
        }

        const navLink =
            document.querySelector(
                `.nav-link[data-target="${viewId}"]`
            );

        if (navLink) {
            navLink.classList.add('active');
        }

        this.state.currentView = viewId;

        window.location.hash = viewId;

        clearInterval(this.state.countdownInterval);

        if (viewId === 'view-dashboard') {
            this.state.lastListRoute = 'view-dashboard';
            this.renderDashboard();
        }

        else if (viewId === 'view-archive') {
            this.state.lastListRoute = 'view-archive';
            this.renderArchive();
        }

        else if (viewId === 'view-timeline') {
            this.renderTimeline();
        }
    },

    // --- PROFILE & SETTINGS ---
    saveProfile() {
        const name =
            document.getElementById('setting-name')
                .value.trim();

        this.data.profile.name = name;

        this.saveData();

        document.getElementById('nav-greeting').innerText =
            `Welcome back, ${name}.`;

        this.showToast("Profile saved.");
    },

    changeTheme(theme) {
        this.data.settings.theme = theme;

        document.body.setAttribute(
            'data-theme',
            theme
        );

        this.saveData();
    },

    enableDemoMode() {
        const timeInput =
            document.getElementById('setting-demo-time').value;

        if (!timeInput) {
            this.showToast(
                "Please select a simulated time.",
                "error"
            );
            return;
        }

        this.data.settings.demoMode = true;

        this.data.settings.simulatedTime =
            new Date(timeInput).toISOString();

        /*
         * IMPORTANT:
         * We intentionally DO NOT modify any capsule status here.
         */
        this.saveData();

        this.updateDemoWidget();

        this.checkUnlocks();

        this.showToast(
            "Time simulation activated."
        );
    },

    disableDemoMode() {
        /*
         * Turning Demo Mode off only changes the application clock.
         * It does NOT modify capsule data.
         */
        this.data.settings.demoMode = false;
        this.data.settings.simulatedTime = null;

        this.saveData();

        document.getElementById('demo-widget').style.display =
            'none';

        clearInterval(this.state.countdownInterval);

        this.checkUnlocks();

        this.showToast(
            "Returned to real time."
        );
    },

    updateDemoWidget() {
        if (this.data.settings.demoMode) {
            const widget =
                document.getElementById('demo-widget');

            widget.style.display = 'block';

            document.getElementById(
                'demo-widget-time'
            ).innerText =
                this.formatDateTime(
                    this.data.settings.simulatedTime
                );
        }
    },

    // --- FORM HANDLING ---
    setupCreateForm() {
        const songsContainer =
            document.getElementById('create-songs');

        songsContainer.innerHTML = '';

        for (let i = 1; i <= 3; i++) {
            songsContainer.innerHTML += `
                <div class="input-group" style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: var(--radius-md);">
                    <label>#${i} Song</label>

                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input
                            type="text"
                            id="song-title-${i}"
                            placeholder="Title"
                            style="flex: 1;"
                        >

                        <input
                            type="text"
                            id="song-artist-${i}"
                            placeholder="Artist"
                            style="flex: 1;"
                        >
                    </div>

                    <input
                        type="text"
                        id="song-reason-${i}"
                        placeholder="Why this song? (Optional)"
                    >
                </div>
            `;
        }

        this.addDynamicItem(
            'goals',
            'A goal...'
        );

        this.addDynamicItem(
            'predictions',
            'A prediction...'
        );

        this.addQAPair();
    },

    addDynamicItem(type, placeholder) {
        const list =
            document.getElementById(
                `create-${type}-list`
            );

        const id =
            Date.now() + Math.random();

        const div =
            document.createElement('div');

        div.className = 'dynamic-item';
        div.id = `item-${id}`;

        div.innerHTML = `
            <div class="input-group">
                <input
                    type="text"
                    class="${type}-input"
                    placeholder="${placeholder}"
                >
            </div>

            <button
                type="button"
                class="remove-btn"
                onclick="document.getElementById('item-${id}').remove()"
            >
                ✕
            </button>
        `;

        list.appendChild(div);
    },

    addQAPair() {
        const list =
            document.getElementById(
                'create-qa-list'
            );

        const id =
            Date.now() + Math.random();

        const div =
            document.createElement('div');

        div.className = 'dynamic-item';
        div.style.flexDirection = 'column';
        div.id = `qa-${id}`;

        div.innerHTML = `
            <div style="display:flex; width: 100%; gap: 10px;">
                <div style="
                    flex-grow:1;
                    display:flex;
                    flex-direction:column;
                    gap:10px;
                    background:rgba(0,0,0,0.02);
                    padding:1rem;
                    border-radius:var(--radius-md);
                ">
                    <input
                        type="text"
                        class="qa-q"
                        placeholder="Question (e.g., What am I afraid of right now?)"
                    >

                    <input
                        type="text"
                        class="qa-a"
                        placeholder="Answer"
                    >
                </div>

                <button
                    type="button"
                    class="remove-btn"
                    onclick="document.getElementById('qa-${id}').remove()"
                >
                    ✕
                </button>
            </div>
        `;

        list.appendChild(div);
    },

    handleImageSelect(event) {
        const files = event.target.files;

        if (!files || files.length === 0) {
            return;
        }

        if (
            this.state.currentImages.length +
            files.length > 5
        ) {
            this.showToast(
                "Maximum 5 images allowed.",
                "error"
            );
            return;
        }

        Array.from(files).forEach(file => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    const canvas =
                        document.createElement('canvas');

                    const MAX_WIDTH = 800;

                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *=
                            MAX_WIDTH / width;

                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx =
                        canvas.getContext('2d');

                    ctx.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );

                    const dataUrl =
                        canvas.toDataURL(
                            'image/jpeg',
                            0.7
                        );

                    this.state.currentImages.push({
                        id:
                            Date.now() +
                            Math.random(),

                        data: dataUrl
                    });

                    this.renderImagePreviews();
                };

                img.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    },

    renderImagePreviews() {
        const container =
            document.getElementById(
                'create-image-previews'
            );

        container.innerHTML = '';

        this.state.currentImages.forEach(imgObj => {
            const wrapper =
                document.createElement('div');

            wrapper.className =
                'img-preview-wrapper';

            wrapper.innerHTML = `
                <img
                    src="${imgObj.data}"
                    class="img-preview"
                >

                <div
                    class="img-remove"
                    onclick="app.removeImage('${imgObj.id}')"
                >
                    ✕
                </div>
            `;

            container.appendChild(wrapper);
        });
    },

    removeImage(id) {
        this.state.currentImages =
            this.state.currentImages.filter(
                img => img.id != id
            );

        this.renderImagePreviews();
    },

    // --- CAPSULE CREATION ---
    initiateSeal() {
        /*
         * Count capsules based on PERMANENT state.
         * A demo-unlocked capsule is still an active capsule.
         */
        const activeCount =
            this.data.capsules.filter(
                c => c.status === 'sealed'
            ).length;

        if (activeCount >= 5) {
            this.showToast(
                "You've reached the limit of 5 active capsules.",
                "error"
            );
            return;
        }

        const unlockDate =
            new Date(
                document.getElementById(
                    'create-unlock'
                ).value
            );

        if (unlockDate <= this.getNow()) {
            this.showToast(
                "Unlock date must be in the future.",
                "error"
            );
            return;
        }

        document
            .getElementById('modal-seal')
            .classList.add('active');
    },

    confirmSeal() {
        this.closeModal('modal-seal');

        const goals =
            Array.from(
                document.querySelectorAll(
                    '.goals-input'
                )
            )
            .map(i => i.value)
            .filter(
                v => v.trim() !== ''
            );

        const predictions =
            Array.from(
                document.querySelectorAll(
                    '.predictions-input'
                )
            )
            .map(i => i.value)
            .filter(
                v => v.trim() !== ''
            );

        const customQuestions =
            Array.from(
                document.querySelectorAll(
                    '#create-qa-list .dynamic-item'
                )
            )
            .map(div => {
                return {
                    question:
                        div.querySelector(
                            '.qa-q'
                        ).value,

                    answer:
                        div.querySelector(
                            '.qa-a'
                        ).value
                };
            })
            .filter(
                qa =>
                    qa.question.trim() !== '' &&
                    qa.answer.trim() !== ''
            );

        const songs = [];

        for (let i = 1; i <= 3; i++) {
            const title =
                document.getElementById(
                    `song-title-${i}`
                ).value;

            const artist =
                document.getElementById(
                    `song-artist-${i}`
                ).value;

            if (title) {
                songs.push({
                    rank: i,
                    title,
                    artist,
                    reason:
                        document.getElementById(
                            `song-reason-${i}`
                        ).value
                });
            }
        }

        const newCapsule = {
            id:
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : 'cap_' + Date.now(),

            title:
                document.getElementById(
                    'create-title'
                ).value,

            createdAt:
                this.getNow().toISOString(),

            unlockAt:
                new Date(
                    document.getElementById(
                        'create-unlock'
                    ).value
                ).toISOString(),

            status: 'sealed',

            favorite: false,

            theme:
                document.getElementById(
                    'create-theme'
                ).value,

            letter:
                document.getElementById(
                    'create-letter'
                ).value,

            images:
                this.state.currentImages.map(
                    img => img.data
                ),

            favoriteSongs: songs,

            goals,

            predictions,

            customQuestions,

            shortMessage:
                document.getElementById(
                    'create-short-message'
                ).value,

            thenNow: {
                currentAnswers: {}
            }
        };

        this.data.capsules.push(
            newCapsule
        );

        this.saveData();

        // Reset form
        document
            .getElementById(
                'create-capsule-form'
            )
            .reset();

        this.state.currentImages = [];

        this.renderImagePreviews();

        this.showToast(
            "Capsule sealed successfully."
        );

        this.navigateTo(
            'view-dashboard'
        );
    },

    // --- RENDERING LISTS ---
    renderDashboard() {
        /*
         * Active capsules are determined by saved state.
         * Demo-unlocked capsules remain active.
         */
        const activeCapsules =
            this.data.capsules.filter(
                c => c.status === 'sealed'
            );

        document.getElementById(
            'capsule-limit-text'
        ).innerText =
            `Active capsules: ${activeCapsules.length}/5`;

        const btn =
            document.getElementById(
                'btn-dashboard-create'
            );

        btn.style.display =
            activeCapsules.length >= 5
                ? 'none'
                : 'block';

        const grid =
            document.getElementById(
                'active-capsules-grid'
            );

        grid.innerHTML =
            activeCapsules.length === 0
                ? '<p class="text-muted">No active capsules. Create one to begin.</p>'
                : '';

        activeCapsules.forEach(cap => {
            grid.appendChild(
                this.createCapsuleCard(cap)
            );
        });
    },

    renderArchive() {
        const archiveCapsules =
            this.data.capsules.filter(
                c => c.status !== 'sealed'
            );

        archiveCapsules.sort(
            (a, b) =>
                new Date(b.openedAt || 0) -
                new Date(a.openedAt || 0)
        );

        const grid =
            document.getElementById(
                'archive-capsules-grid'
            );

        grid.innerHTML =
            archiveCapsules.length === 0
                ? '<p class="text-muted">Archive is empty.</p>'
                : '';

        archiveCapsules.forEach(cap => {
            grid.appendChild(
                this.createCapsuleCard(cap)
            );
        });
    },

    createCapsuleCard(capsule) {
        const card =
            document.createElement('div');

        const displayStatus =
            this.getCapsuleDisplayStatus(
                capsule
            );

        card.className =
            `capsule-card ${
                displayStatus === 'seal_broken'
                    ? 'broken'
                    : displayStatus
            } theme-${capsule.theme}`;

        const favClass =
            capsule.favorite
                ? 'active'
                : '';

        const favHeart =
            capsule.favorite
                ? '♥'
                : '♡';

        let statusText =
            '🔒 SEALED';

        if (displayStatus === 'unlocked') {
            statusText =
                '🔓 UNLOCKED';
        }

        if (displayStatus === 'seal_broken') {
            statusText =
                '⚠️ SEAL BROKEN';
        }

        let countdownHtml = '';

        if (displayStatus === 'sealed') {
            const days =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            new Date(
                                capsule.unlockAt
                            ) -
                            this.getNow()
                        ) /
                        (
                            1000 *
                            60 *
                            60 *
                            24
                        )
                    )
                );

            countdownHtml = `
                <div class="countdown">
                    ${days} days remaining
                </div>
            `;
        }

        else if (
            this.data.settings.demoMode &&
            capsule.status === 'sealed'
        ) {
            countdownHtml = `
                <div
                    class="countdown"
                    style="border:none; padding:0; text-align:left;"
                >
                    Demo preview — not permanently unlocked
                </div>
            `;
        }

        else {
            countdownHtml = `
                <div
                    class="countdown"
                    style="border:none; padding:0; text-align:left;"
                >
                    Opened on ${this.formatDate(
                        capsule.openedAt
                    )}
                </div>
            `;
        }

        card.innerHTML = `
            <button
                class="fav-btn ${favClass}"
                onclick="event.stopPropagation(); app.toggleFavorite('${capsule.id}')"
            >
                ${favHeart}
            </button>

            <div
                class="card-status ${
                    displayStatus === 'seal_broken'
                        ? 'broken'
                        : displayStatus
                }"
            >
                <span>
                    ${statusText}
                </span>
            </div>

            <h3>
                ${capsule.title}
            </h3>

            <div class="card-dates">
                Created:
                ${this.formatDate(
                    capsule.createdAt
                )}
                <br>

                Opens:
                ${this.formatDate(
                    capsule.unlockAt
                )}
            </div>

            ${countdownHtml}
        `;

        card.onclick = () =>
            this.openCapsuleView(
                capsule.id
            );

        return card;
    },

    toggleFavorite(id) {
        const cap =
            this.data.capsules.find(
                c => c.id === id
            );

        if (cap) {
            cap.favorite =
                !cap.favorite;

            this.saveData();

            if (
                this.state.currentView ===
                'view-dashboard'
            ) {
                this.renderDashboard();
            }

            if (
                this.state.currentView ===
                'view-archive'
            ) {
                this.renderArchive();
            }
        }
    },

    // --- TIMELINE ---
    renderTimeline() {
        const container =
            document.getElementById(
                'timeline-container'
            );

        container.innerHTML = '';

        const sorted =
            [...this.data.capsules].sort(
                (a, b) =>
                    new Date(a.createdAt) -
                    new Date(b.createdAt)
            );

        if (sorted.length === 0) {
            container.innerHTML =
                '<p class="text-muted" style="padding-left: 20px;">Timeline is empty.</p>';

            return;
        }

        let currentYear = '';

        sorted.forEach(cap => {
            const date =
                new Date(cap.createdAt);

            const year =
                date.getFullYear();

            if (year !== currentYear) {
                const yearLabel =
                    document.createElement('h2');

                yearLabel.style.paddingLeft =
                    '40px';

                yearLabel.style.marginBottom =
                    '1rem';

                yearLabel.style.color =
                    'var(--accent-color)';

                yearLabel.innerText =
                    year;

                container.appendChild(
                    yearLabel
                );

                currentYear = year;
            }

            const displayStatus =
                this.getCapsuleDisplayStatus(
                    cap
                );

            const item =
                document.createElement('div');

            item.className =
                `timeline-item ${
                    displayStatus !== 'sealed'
                        ? 'unlocked'
                        : ''
                }`;

            const statusIcon =
                displayStatus === 'sealed'
                    ? '🔒'
                    : displayStatus === 'seal_broken'
                        ? '⚠️'
                        : '🔓';

            let timelineText =
                'Unlocks ' +
                this.formatDate(
                    cap.unlockAt
                );

            if (
                displayStatus ===
                'seal_broken'
            ) {
                timelineText =
                    'Seal broken';
            }

            else if (
                displayStatus ===
                'unlocked'
            ) {
                if (
                    this.data.settings.demoMode &&
                    cap.status === 'sealed'
                ) {
                    timelineText =
                        'Demo preview';
                } else {
                    timelineText =
                        'Opened';
                }
            }

            item.innerHTML = `
                <div class="timeline-dot"></div>

                <div class="timeline-date">
                    ${date.toLocaleDateString(
                        undefined,
                        {
                            month: 'short',
                            day: 'numeric'
                        }
                    )}
                </div>

                <div
                    style="
                        background: var(--surface-color);
                        padding: 1rem;
                        border-radius: var(--radius-md);
                        border: 1px solid var(--border-color);
                        display: inline-block;
                        min-width: 200px;
                    "
                >
                    <strong>
                        ${cap.title}
                    </strong>
                    ${statusIcon}

                    <div
                        style="
                            font-size: 0.8rem;
                            color: var(--text-muted);
                            margin-top: 5px;
                        "
                    >
                        ${timelineText}
                    </div>
                </div>
            `;

            container.appendChild(item);
        });
    },

    // --- VIEW CAPSULE ---
    openCapsuleView(id) {
        const cap =
            this.data.capsules.find(
                c => c.id === id
            );

        if (!cap) {
            return;
        }

        this.state.activeCapsuleId = id;

        this.navigateTo(
            'view-capsule'
        );

        const container =
            document.getElementById(
                'capsule-container'
            );

        container.className =
            `capsule-reading-view theme-${cap.theme}`;

        const displayStatus =
            this.getCapsuleDisplayStatus(
                cap
            );

        if (displayStatus === 'sealed') {
            document
                .getElementById(
                    'capsule-locked-content'
                )
                .classList.remove('hidden');

            document
                .getElementById(
                    'capsule-unlocked-content'
                )
                .classList.add('hidden');

            document.getElementById(
                'locked-title'
            ).innerText =
                cap.title;

            document.getElementById(
                'locked-created'
            ).innerText =
                this.formatDate(
                    cap.createdAt
                );

            document.getElementById(
                'locked-unlocks'
            ).innerText =
                this.formatDateTime(
                    cap.unlockAt
                );

            this.startCountdown(
                cap.unlockAt
            );
        }

        else {
            document
                .getElementById(
                    'capsule-locked-content'
                )
                .classList.add('hidden');

            document
                .getElementById(
                    'capsule-unlocked-content'
                )
                .classList.remove('hidden');

            this.renderUnlockedContent(
                cap
            );
        }
    },

    startCountdown(targetDateStr) {
        clearInterval(
            this.state.countdownInterval
        );

        const target =
            new Date(
                targetDateStr
            ).getTime();

        const update = () => {
            const now =
                this.getNow().getTime();

            const diff =
                target - now;

            if (diff <= 0) {
                clearInterval(
                    this.state.countdownInterval
                );

                this.checkUnlocks();

                return;
            }

            const d =
                Math.floor(
                    diff /
                    (
                        1000 *
                        60 *
                        60 *
                        24
                    )
                );

            const h =
                Math.floor(
                    (
                        diff %
                        (
                            1000 *
                            60 *
                            60 *
                            24
                        )
                    ) /
                    (
                        1000 *
                        60 *
                        60
                    )
                );

            const m =
                Math.floor(
                    (
                        diff %
                        (
                            1000 *
                            60 *
                            60
                        )
                    ) /
                    (
                        1000 *
                        60
                    )
                );

            const s =
                Math.floor(
                    (
                        diff %
                        (
                            1000 *
                            60
                        )
                    ) /
                    1000
                );

            document.getElementById(
                'cd-d'
            ).innerText =
                d.toString().padStart(
                    2,
                    '0'
                );

            document.getElementById(
                'cd-h'
            ).innerText =
                h.toString().padStart(
                    2,
                    '0'
                );

            document.getElementById(
                'cd-m'
            ).innerText =
                m.toString().padStart(
                    2,
                    '0'
                );

            document.getElementById(
                'cd-s'
            ).innerText =
                s.toString().padStart(
                    2,
                    '0'
                );
        };

        update();

        this.state.countdownInterval =
            setInterval(
                update,
                1000
            );
    },

    renderUnlockedContent(cap) {
        const displayStatus =
            this.getCapsuleDisplayStatus(
                cap
            );

        document.getElementById(
            'read-title'
        ).innerText =
            cap.title +
            (
                displayStatus ===
                'seal_broken'
                    ? ' (Seal Broken)'
                    : ''
            );

        document.getElementById(
            'read-created'
        ).innerText =
            this.formatDate(
                cap.createdAt
            );

        /*
         * Demo-unlocked capsules don't have a real openedAt.
         */
        if (
            this.data.settings.demoMode &&
            cap.status === 'sealed' &&
            displayStatus === 'unlocked'
        ) {
            document.getElementById(
                'read-opened'
            ).innerText =
                'Demo Preview — not permanently opened';
        }

        else if (cap.openedAt) {
            document.getElementById(
                'read-opened'
            ).innerText =
                this.formatDate(
                    cap.openedAt
                );
        }

        else {
            document.getElementById(
                'read-opened'
            ).innerText =
                'Not opened yet';
        }

        document.getElementById(
            'read-letter'
        ).innerText =
            cap.letter;

        // Images
        const imgContainer =
            document.getElementById(
                'read-images'
            );

        if (
            cap.images &&
            cap.images.length > 0
        ) {
            document.getElementById(
                'section-images'
            ).style.display =
                'block';

            imgContainer.innerHTML =
                cap.images
                    .map(
                        src => `
                            <img
                                src="${src}"
                                style="
                                    max-width:100%;
                                    border-radius:var(--radius-md);
                                    box-shadow:var(--shadow-sm);
                                "
                            >
                        `
                    )
                    .join('');
        }

        else {
            document.getElementById(
                'section-images'
            ).style.display =
                'none';
        }

        // Songs
        const songsContainer =
            document.getElementById(
                'read-songs'
            );

        if (
            cap.favoriteSongs &&
            cap.favoriteSongs.length > 0
        ) {
            document.getElementById(
                'section-songs'
            ).style.display =
                'block';

            songsContainer.innerHTML =
                cap.favoriteSongs
                    .map(
                        s => `
                            <div style="margin-bottom:1rem;">
                                <strong>
                                    #${s.rank}
                                    ${s.title}
                                </strong>
                                by ${s.artist}

                                ${
                                    s.reason
                                        ? `
                                            <br>
                                            <span
                                                style="
                                                    font-style:italic;
                                                    color:var(--text-muted);
                                                "
                                            >
                                                "${s.reason}"
                                            </span>
                                        `
                                        : ''
                                }
                            </div>
                        `
                    )
                    .join('');
        }

        else {
            document.getElementById(
                'section-songs'
            ).style.display =
                'none';
        }

        // THEN VS NOW
        const tnGoals =
            document.getElementById(
                'then-now-goals'
            );

        const tnPreds =
            document.getElementById(
                'then-now-predictions'
            );

        const tnQA =
            document.getElementById(
                'then-now-qa'
            );

        let hasThenNowContent =
            false;

        tnGoals.innerHTML = '';
        tnPreds.innerHTML = '';
        tnQA.innerHTML = '';

        if (!cap.thenNow) {
            cap.thenNow = {
                currentAnswers: {}
            };
        }

        if (!cap.thenNow.currentAnswers) {
            cap.thenNow.currentAnswers = {};
        }

        const currentAnswers =
            cap.thenNow.currentAnswers;

        let isEditing = false;

        const buildThenNowRow =
            (
                id,
                label,
                thenText
            ) => {
                hasThenNowContent = true;

                const nowVal =
                    currentAnswers[id] ||
                    '';

                if (!nowVal) {
                    isEditing = true;
                }

                return `
                    <div class="then-now-grid mb-4">
                        <div class="then-col">
                            <div
                                class="text-muted"
                                style="
                                    font-size:0.8rem;
                                    text-transform:uppercase;
                                "
                            >
                                ${label} (Then)
                            </div>

                            <div>
                                ${thenText}
                            </div>
                        </div>

                        <div class="now-col">
                            <div
                                class="text-muted"
                                style="
                                    font-size:0.8rem;
                                    text-transform:uppercase;
                                "
                            >
                                Now
                            </div>

                            ${
                                nowVal
                                    ? `
                                        <div>
                                            ${nowVal}
                                        </div>
                                    `
                                    : `
                                        <textarea
                                            data-tn-id="${id}"
                                            class="tn-input"
                                            placeholder="Reflect on this now..."
                                            style="
                                                min-height:60px;
                                                width:100%;
                                                border:none;
                                                background:transparent;
                                                resize:none;
                                            "
                                        ></textarea>
                                    `
                            }
                        </div>
                    </div>
                `;
            };

        if (
            cap.goals &&
            cap.goals.length > 0
        ) {
            tnGoals.innerHTML =
                '<h4 class="serif mt-4 mb-4">Goals</h4>' +
                cap.goals
                    .map(
                        (g, i) =>
                            buildThenNowRow(
                                `goal_${i}`,
                                'Goal',
                                g
                            )
                    )
                    .join('');
        }

        if (
            cap.predictions &&
            cap.predictions.length > 0
        ) {
            tnPreds.innerHTML =
                '<h4 class="serif mt-4 mb-4">Predictions</h4>' +
                cap.predictions
                    .map(
                        (p, i) =>
                            buildThenNowRow(
                                `pred_${i}`,
                                'Prediction',
                                p
                            )
                    )
                    .join('');
        }

        if (
            cap.customQuestions &&
            cap.customQuestions.length > 0
        ) {
            tnQA.innerHTML =
                '<h4 class="serif mt-4 mb-4">Q&A</h4>' +
                cap.customQuestions
                    .map(
                        (qa, i) =>
                            buildThenNowRow(
                                `qa_${i}`,
                                qa.question,
                                qa.answer
                            )
                    )
                    .join('');
        }

        const btnSaveNow =
            document.getElementById(
                'btn-save-now'
            );

        if (hasThenNowContent) {
            document.getElementById(
                'section-then-now'
            ).style.display =
                'block';

            btnSaveNow.className =
                isEditing
                    ? 'btn btn-primary'
                    : 'hidden';
        }

        else {
            document.getElementById(
                'section-then-now'
            ).style.display =
                'none';

            btnSaveNow.className =
                'hidden';
        }

        // Final Message
        document.getElementById(
            'read-short-message'
        ).innerText =
            cap.shortMessage;
    },

    saveThenNowAnswers() {
        const cap =
            this.data.capsules.find(
                c =>
                    c.id ===
                    this.state.activeCapsuleId
            );

        if (!cap) {
            return;
        }

        if (!cap.thenNow) {
            cap.thenNow = {
                currentAnswers: {}
            };
        }

        if (!cap.thenNow.currentAnswers) {
            cap.thenNow.currentAnswers = {};
        }

        const inputs =
            document.querySelectorAll(
                '.tn-input'
            );

        let savedAny = false;

        inputs.forEach(input => {
            if (input.value.trim()) {
                cap.thenNow.currentAnswers[
                    input.getAttribute(
                        'data-tn-id'
                    )
                ] =
                    input.value.trim();

                savedAny = true;
            }
        });

        if (savedAny) {
            this.saveData();

            this.renderUnlockedContent(
                cap
            );

            this.showToast(
                "Reflections saved to archive."
            );
        }

        else {
            this.showToast(
                "No new reflections to save.",
                "error"
            );
        }
    },

    // --- UNLOCK LOGIC ---
    checkUnlocks() {
        const now =
            this.getNow();

        let newlyUnlocked = 0;

        /*
         * DEMO MODE
         *
         * Never permanently change capsule status.
         * The visual unlock is handled by
         * getCapsuleDisplayStatus().
         */
        if (this.data.settings.demoMode) {
            if (
                this.state.currentView ===
                'view-dashboard'
            ) {
                this.renderDashboard();
            }

            else if (
                this.state.currentView ===
                'view-archive'
            ) {
                this.renderArchive();
            }

            else if (
                this.state.currentView ===
                'view-timeline'
            ) {
                this.renderTimeline();
            }

            else if (
                this.state.currentView ===
                'view-capsule' &&
                this.state.activeCapsuleId
            ) {
                this.openCapsuleView(
                    this.state.activeCapsuleId
                );
            }

            return;
        }

        /*
         * REAL TIME
         *
         * Only now can a capsule become
         * permanently unlocked.
         */
        this.data.capsules.forEach(cap => {
            if (cap.status !== 'sealed') {
                return;
            }

            const unlockTime =
                new Date(
                    cap.unlockAt
                );

            if (now >= unlockTime) {
                cap.status =
                    'unlocked';

                cap.openedAt =
                    now.toISOString();

                newlyUnlocked++;

                if (
                    this.state.currentView ===
                    'view-capsule' &&
                    this.state.activeCapsuleId ===
                    cap.id
                ) {
                    this.openCapsuleView(
                        cap.id
                    );
                }
            }
        });

        if (newlyUnlocked > 0) {
            this.saveData();

            this.showToast(
                `🔓 ${newlyUnlocked} capsule(s) just unlocked!`
            );

            if (
                this.state.currentView ===
                'view-dashboard'
            ) {
                this.renderDashboard();
            }

            if (
                this.state.currentView ===
                'view-archive'
            ) {
                this.renderArchive();
            }

            if (
                this.state.currentView ===
                'view-timeline'
            ) {
                this.renderTimeline();
            }
        }
    },

    // --- BREAK SEAL ---
    requestBreakSeal() {
        document
            .getElementById(
                'modal-break'
            )
            .classList.add('active');
    },

    executeBreakSeal() {
        this.closeModal(
            'modal-break'
        );

        const cap =
            this.data.capsules.find(
                c =>
                    c.id ===
                    this.state.activeCapsuleId
            );

        if (!cap) {
            return;
        }

        /*
         * Break Seal is a permanent user action.
         *
         * It is different from Demo Mode.
         */
        if (
            cap.status === 'sealed'
        ) {
            cap.status =
                'seal_broken';

            cap.openedAt =
                new Date().toISOString();

            this.saveData();

            this.openCapsuleView(
                cap.id
            );

            this.showToast(
                "Seal broken.",
                "error"
            );
        }
    },

    // --- UTILS ---
    closeModal(id) {
        document
            .getElementById(id)
            .classList.remove('active');
    },

    showToast(
        message,
        type = 'success'
    ) {
        const container =
            document.getElementById(
                'toast-container'
            );

        const toast =
            document.createElement('div');

        toast.className =
            'toast';

        if (type === 'error') {
            toast.style.borderLeftColor =
                '#C24A3F';
        }

        toast.innerHTML =
            `<span>${message}</span>`;

        container.appendChild(
            toast
        );

        setTimeout(() => {
            toast.style.opacity =
                '0';

            toast.style.transform =
                'translateX(100%)';

            setTimeout(
                () => toast.remove(),
                300
            );
        }, 3000);
    },

    // --- EXPORT / IMPORT ---
    exportData() {
        const dataStr =
            JSON.stringify(
                this.data,
                null,
                2
            );

        const blob =
            new Blob(
                [dataStr],
                {
                    type:
                        "application/json"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                'a'
            );

        a.href = url;

        const date =
            new Date()
                .toISOString()
                .split('T')[0];

        a.download =
            `time-capsule-backup-${date}.json`;

        document.body.appendChild(
            a
        );

        a.click();

        document.body.removeChild(
            a
        );

        URL.revokeObjectURL(
            url
        );
    },

    importData(event) {
        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        const reader =
            new FileReader();

        reader.onload = (e) => {
            try {
                const importedData =
                    JSON.parse(
                        e.target.result
                    );

                if (
                    importedData &&
                    importedData.capsules
                ) {
                    this.data =
                        importedData;

                    this.saveData();

                    this.applySettings();

                    this.showToast(
                        "Backup imported successfully."
                    );

                    setTimeout(
                        () =>
                            window.location.reload(),
                        1500
                    );
                }

                else {
                    throw new Error(
                        "Invalid format"
                    );
                }
            }

            catch (err) {
                console.error(
                    "Import error:",
                    err
                );

                this.showToast(
                    "Invalid backup file.",
                    "error"
                );
            }
        };

        reader.readAsText(file);
    }
};


// Initialize application
window.addEventListener(
    'DOMContentLoaded',
    () => {
        App.init();
    }
);


// Expose App globally for inline onclick handlers
window.app = App;