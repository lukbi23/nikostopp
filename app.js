document.addEventListener('DOMContentLoaded', () => {
    // ───────────────────────── Elemente ─────────────────────────
    const $ = (id) => document.getElementById(id);
    const onboardingForm = $('onboardingForm');
    const onboardingCard = $('onboardingCard');
    const dashboardCard = $('dashboardCard');
    const bottomNav = $('bottomNav');
    const sosOverlay = $('sosOverlay');
    const sosModalContent = $('sosModalContent');
    const triggerOverlay = $('triggerOverlay');
    const triggerForm = $('triggerForm');
    const btnCancelTrigger = $('btnCancelTrigger');
    const relapseOverlay = $('relapseOverlay');
    const relapseModalContent = $('relapseModalContent');
    const helpOverlay = $('helpOverlay');
    const btnCloseHelp = $('btnCloseHelp');
    const legalOverlay = $('legalOverlay');
    const btnCloseLegal = $('btnCloseLegal');
    const btnLegalOnboarding = $('btnLegalOnboarding');
    const actOverlay = $('actOverlay');
    const actModalContent = $('actModalContent');
    const commitmentOverlay = $('commitmentOverlay');
    const commitmentModalContent = $('commitmentModalContent');
    const importFile = $('importFile');

    const STORAGE_KEY = 'nikotinstopp_user_data';
    const SOS_DAUER_MS = 10 * 60 * 1000;
    const ZIEL_TAGE = 180;

    let timerInterval = null;
    let wakeLock = null;
    let justCheckedInClean = false;
    let activeTab = 'home';
    let selectedActLessonId = null;

    const TRIGGER_KATEGORIEN = [
        'Stress / Ärger',
        'Kaffee / Mahlzeit',
        'Geselligkeit / Alkohol',
        'Langeweile / Wartezeit',
        'Gewohnheit / Ort',
        'Spontaner Drang'
    ];

    const actLektionenData = [
        {
            id: 'akt1',
            titel: '1. Akzeptanz statt Kampf',
            kategorie: 'Akzeptanz',
            inhalt: 'Suchtdrang fühlt sich unangenehm an. Versuchst du ihn krampfhaft zu unterdrücken, wird er meist stetig stärker. Erlaube dem Gefühl einfach da zu sein – wie eine Welle im Meer, die kommt, ihren Höhepunkt erreicht und von selbst abflacht.',
            uebung: 'Sag dir bei jedem Drang gedanklich: "Ich spüre einen Drang. Das ist okay, er geht von alleine wieder."'
        },
        {
            id: 'akt2',
            titel: '2. Gedanken sind keine Befehle',
            kategorie: 'Entkopplung',
            inhalt: 'Dein Gehirn erzeugt in Suchtmomenten Gedanken wie "Ich brauche jetzt unbedingt eine Dosis". Erinnere dich daran: Ein Gedanke ist nur ein Satz in deinem Kopf – kein Befehl, dem du gehorchen musst.',
            uebung: 'Ergänze den Gedanken mit: "Ich habe gerade den Gedanken, dass...". Das schafft Abstand.'
        },
        {
            id: 'akt3',
            titel: '3. Werte als Kompass',
            kategorie: 'Werte',
            inhalt: 'Statt dein Handeln vom kurzfristigen Entzug steuern zu lassen, richte dich an deinen persönlichen Werten aus: Freiheit, Gesundheit oder Vorbild sein. Was für ein Mensch möchtest du sein?',
            uebung: 'Lies dir deine persönliche Motivation durch und verbinde sie gedanklich mit deinem wichtigsten Wert.'
        },
        {
            id: 'akt4',
            titel: '4. Handeln trotz Verlangen',
            kategorie: 'Commitment',
            inhalt: 'Du musst nicht warten, bis der Suchtdrang zu 100% verschwunden ist, um etwas Sinnvolles zu tun. Du kannst das unangenehme Gefühl mitnehmen und gleichzeitig etwas tun, das dir gut tut.',
            uebung: 'Mache trotz Drang genau jetzt 5 Minuten lang eine Aktivität, die deiner Gesundheit dient.'
        }
    ];

    // ───────────────────────── Hilfsfunktionen ─────────────────────────
    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, (m) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]
        ));
    }

    function pad(n) { return String(n).padStart(2, '0'); }
    function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function parseISODate(s) {
        const [y, m, d] = String(s).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    }
    function heuteISO() { return toISODate(new Date()); }
    function tageZwischen(neuer, aelter) {
        const a = Date.UTC(neuer.getFullYear(), neuer.getMonth(), neuer.getDate());
        const b = Date.UTC(aelter.getFullYear(), aelter.getMonth(), aelter.getDate());
        return Math.round((a - b) / 86400000);
    }
    function formatDatum(d) {
        return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    function addDaysFormatted(startISO, tage) {
        const d = parseISODate(startISO);
        d.setDate(d.getDate() + tage);
        return formatDatum(d);
    }
    function formatTriggerZeit(t) {
        if (t.ts) {
            return new Date(t.ts).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }
        return t.datum || '';
    }

    function normalisiere(data) {
        if (data.cravingsBewaeltigt === undefined) data.cravingsBewaeltigt = 0;
        if (!Array.isArray(data.checkIns)) data.checkIns = [];
        if (!Array.isArray(data.triggers)) data.triggers = [];
        if (!Array.isArray(data.actCompleted)) data.actCompleted = [];
        if (data.commitment === undefined) data.commitment = null;
        if (data.commitment && data.commitment.active && !data.commitment.startDatumISO) {
            const m = String(data.commitment.startDatum || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            data.commitment.startDatumISO = m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : data.stichtag;
        }
        if (!data.reminder || typeof data.reminder !== 'object') {
            data.reminder = { enabled: false, time: '19:00', lastNotifiedDate: '' };
        }
        return data;
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? normalisiere(JSON.parse(raw)) : null;
        } catch (err) {
            console.error('Daten konnten nicht gelesen werden:', err);
            return null;
        }
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (err) {
            console.error('Speichern fehlgeschlagen:', err);
            alert('Speichern fehlgeschlagen. Ist der Speicher deines Browsers voll oder blockiert?');
        }
    }

    function getNikotinName(form) {
        if (form === 'snus') return 'Snus';
        if (form === 'zigaretten') return 'Zigaretten';
        return 'Nikotin';
    }

    function getUnkonsumiertLabel(form) {
        if (form === 'snus') return 'Unkonsumierte Portionen Snus';
        if (form === 'zigaretten') return 'Unkonsumierte Zigaretten';
        return 'Unkonsumierte Einheiten';
    }

    function closeOverlay(el) { el.style.display = 'none'; }

    // ───────────────────────── Erinnerungen (Notification API) ─────────────────────────
    function sendeSystemMitteilung(titel, text) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            new Notification(titel, {
                body: text,
                icon: 'icon-192.png'
            });
        } catch (err) {
            // Fallback über Service Worker (wichtig für mobile Browser)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(titel, { body: text, icon: 'icon-192.png' });
                }).catch(() => {});
            }
        }
    }

    function pruefeTagesErinnerung(data) {
        if (!data || !data.reminder || !data.reminder.enabled) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const heuteStr = heuteISO();
        if (data.reminder.lastNotifiedDate === heuteStr) return;

        const heuteCheckIn = data.checkIns.find(c => c.datum === heuteStr);
        if (heuteCheckIn) return;

        const jetzt = new Date();
        const [std, min] = String(data.reminder.time || '19:00').split(':').map(Number);
        const zielZeit = new Date();
        zielZeit.setHours(std || 19, min || 0, 0, 0);

        if (jetzt >= zielZeit) {
            data.reminder.lastNotifiedDate = heuteStr;
            saveData(data);
            sendeSystemMitteilung(
                'NikoStopp – Tages-Check-in',
                'Wie läuft dein Ausstieg heute? Trage kurz deinen Tages-Check-in ein.'
            );
        }
    }

    // ───────────────────────── Tab-Navigation ─────────────────────────
    function switchTab(tabName) {
        activeTab = tabName;
        if (tabName !== 'act') selectedActLessonId = null;
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        const data = loadData();
        if (data) showDashboard(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (bottomNav) {
        bottomNav.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
    }

    // ───────────────────────── Statistik ─────────────────────────
    function berechneStatistik(data) {
        const heute = new Date();
        heute.setHours(0, 0, 0, 0);
        const start = parseISODate(data.stichtag);

        const tageGesamt = Math.max(0, tageZwischen(heute, start));
        const startVorbei = tageZwischen(heute, start) >= 0;

        const slipDaten = [...new Set(
            data.checkIns
                .filter(c => c.status === 'slip' && c.datum >= data.stichtag)
                .map(c => c.datum)
        )].sort();

        const letzterSlip = slipDaten.length ? slipDaten[slipDaten.length - 1] : null;
        const heuteStr = toISODate(heute);

        const serie = letzterSlip
            ? Math.max(0, tageZwischen(heute, parseISODate(letzterSlip)))
            : tageGesamt;

        const slipTageVergangen = slipDaten.filter(d => d < heuteStr).length;
        const freieTage = Math.max(0, tageGesamt - slipTageVergangen);

        return {
            tageGesamt,
            startVorbei,
            serie,
            slipAnzahl: slipDaten.length,
            hatSlip: slipDaten.length > 0,
            gespartesGeld: (freieTage * data.tagesKosten).toFixed(2),
            eingesparteEinheiten: freieTage * data.tagesMenge
        };
    }

    function getPhaseInfo(tage) {
        if (tage <= 3) {
            return {
                title: 'Phase 1: Tag 1–3 (Akutphase)',
                tip: 'Entzugssymptome sind meist um Tag 3 am stärksten und klingen danach ab. Einzelne Cravings dauern oft nur wenige Minuten bis etwa 20 Minuten.'
            };
        } else if (tage <= 14) {
            return {
                title: 'Phase 2: Woche 1–2 (Kritische Phase)',
                tip: 'Die ersten zwei Wochen sind für viele die schwierigste Zeit. Halte durch – der schwerste körperliche Teil liegt bald hinter dir.'
            };
        } else if (tage <= 30) {
            return {
                title: 'Phase 3: Monat 1 (Stabilisierung)',
                tip: 'Körperliche Entzugssymptome klingen in 3 bis 4 Wochen meist weitgehend ab. Beobachte jetzt vor allem deine Verhaltensauslöser.'
            };
        }
        return {
            title: 'Phase 4: Monat 2+ (Langzeit-Festigung)',
            tip: 'Starke Leistung! Bleibe wachsam bei spontanen Auslösern. Akzeptiere plötzliche Impulse als kurze Wellen, ohne sie zu bekämpfen.'
        };
    }

    // ───────────────────────── Kalender ─────────────────────────
    function renderCalendarHTML(data) {
        const start = parseISODate(data.stichtag);
        const heute = new Date();
        heute.setHours(0, 0, 0, 0);
        const heuteStr = toISODate(heute);

        const diff = tageZwischen(heute, start);
        const startOffset = diff > 13 ? diff - 13 : 0;

        let daysHTML = '';
        for (let i = 0; i < 14; i++) {
            const dayNumber = startOffset + i + 1;
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + startOffset + i);
            const dateStr = toISODate(currentDate);

            let phaseShort = 'P1';
            if (dayNumber > 30) phaseShort = 'P4';
            else if (dayNumber > 14) phaseShort = 'P3';
            else if (dayNumber > 3) phaseShort = 'P2';

            const checkIn = data.checkIns.find(c => c.datum === dateStr);
            let statusClass = '';
            let icon = '·';

            if (checkIn) {
                statusClass = checkIn.status === 'clean' ? 'clean' : 'slip';
                icon = checkIn.status === 'clean' ? '✅' : '⚠️';
            } else if (dateStr < heuteStr) {
                statusClass = 'clean';
                icon = '✓';
            }

            const isToday = dateStr === heuteStr ? 'today' : '';

            daysHTML += `
                <div class="cal-day ${statusClass} ${isToday}" title="Tag ${dayNumber} (${dateStr})">
                    <div>T${dayNumber}</div>
                    <div style="font-size: 13px; margin: 2px 0;">${icon}</div>
                    <span class="cal-phase-tag">${phaseShort}</span>
                </div>
            `;
        }

        return `
            <div class="calendar-section">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 14px; color: #0f172a;">🗓️ Dein 14-Tage-Verlauf & Phasen</strong>
                    <small style="font-size: 11px; color: #64748b;">P1: Tag 1-3 | P2: W1-2</small>
                </div>
                <div class="calendar-grid">${daysHTML}</div>
            </div>
        `;
    }

    // ───────────────────────── Dashboard & Tab-Views ─────────────────────────
    function commitmentWerte(c, data) {
        const tag = Number(c.tagesBetrag ?? c.betrag ?? data.tagesKosten ?? 0);
        const zyklus = c.zyklus || 'täglich';
        const faktor = zyklus === 'wöchentlich' ? 7 : (zyklus === 'monatlich' ? 30 : 1);
        const zyklusBetrag = Number(c.zyklusBetrag ?? (tag * faktor));
        return { tag, zyklus, zyklusBetrag };
    }

    function ausloeserAuswertung(data) {
        if (data.triggers.length < 3) return '';
        const zaehler = {};
        data.triggers.forEach(t => {
            const name = String(t.kategorie || '').replace(/^Ausrutscher:\s*/, '');
            if (name) zaehler[name] = (zaehler[name] || 0) + 1;
        });
        const top = Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0];
        if (!top) return '';
        return `<p style="font-size: 13px; color: #0f766e; margin: 0 0 10px 0;">📊 Häufigster Auslöser: <strong>${escapeHtml(top[0])}</strong> (${top[1]}×)</p>`;
    }

    function showDashboard(data) {
        normalisiere(data);
        onboardingCard.style.display = 'none';
        dashboardCard.style.display = 'block';
        if (bottomNav) bottomNav.style.display = 'block';

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });

        const stats = berechneStatistik(data);

        if (activeTab === 'kalender') {
            renderKalenderTab(data, stats);
        } else if (activeTab === 'commitment') {
            renderCommitmentTab(data);
        } else if (activeTab === 'act') {
            renderActTab(data);
        } else {
            renderHomeTab(data, stats);
        }
    }

    // ── TAB 1: HOME ──
    function renderHomeTab(data, stats) {
        const heuteStr = heuteISO();
        const heuteCheckIn = data.checkIns.find(c => c.datum === heuteStr);
        const nikotinName = getNikotinName(data.nikotinForm);

        let checkInHTML = '';
        if (!heuteCheckIn) {
            checkInHTML = `
                <div class="checkin-card" id="checkinCard">
                    <div class="checkin-title">📅 Tages-Check-in für heute</div>
                    <p style="font-size: 14px; margin: 0 0 10px 0;">Wie läuft dein Ausstieg heute?</p>
                    <div class="checkin-buttons">
                        <button id="btnCheckinClean" class="btn-success">✅ Frei geblieben</button>
                        <button id="btnCheckinSlip" class="btn-warning">⚠️ Ausrutscher</button>
                    </div>
                </div>
            `;
        } else if (heuteCheckIn.status === 'clean') {
            if (justCheckedInClean) {
                justCheckedInClean = false;
                checkInHTML = `
                    <div class="celebrate-banner">
                        <div style="font-size: 28px; margin-bottom: 4px;">🎉 🏆 ✨</div>
                        <strong>Stark! Ein weiterer Tag frei geblieben!</strong><br>
                        <small>Dein Fortschritt wurde im Kalender eingetragen.</small>
                    </div>
                `;
            } else {
                checkInHTML = `
                    <div class="tip-box" style="margin-bottom: 16px; background: #dcfce7; border-left-color: #16a34a; color: #14532d;">
                        <strong>Tages-Check-in erledigt:</strong> ✅ Heute frei geblieben! Super gemacht.
                    </div>
                `;
            }
        } else {
            checkInHTML = `
                <div class="tip-box" style="margin-bottom: 16px; background: #ffedd5; border-left-color: #ea580c; color: #7c2d12;">
                    <strong>Tages-Check-in erledigt:</strong> ⚠️ Ausrutscher verbucht. Schwamm drüber – direkt weitermachen!
                </div>
            `;
        }

        const zukunftHTML = !stats.startVorbei ? `
            <div class="tip-box" style="margin-bottom: 16px;">
                <strong>Dein Stichtag ist am ${formatDatum(parseISODate(data.stichtag))}.</strong>
                Bis dahin zählt die App noch nicht – bereite dich vor und schau dir die ACT-Lektionen an.
            </div>
        ` : '';

        let triggersHTML;
        if (data.triggers.length === 0) {
            triggersHTML = '<p style="font-size: 13px; color: #64748b; margin: 0;">Noch keine Auslöser eingetragen.</p>';
        } else {
            triggersHTML = [...data.triggers].reverse().slice(0, 5).map(t => `
                <div class="trigger-item">
                    <div class="trigger-header">
                        <span>${escapeHtml(t.kategorie)}</span>
                        <small style="color:#64748b; font-weight:normal;">${escapeHtml(formatTriggerZeit(t))}</small>
                    </div>
                    <div>${escapeHtml(t.notiz)}</div>
                </div>
            `).join('');
        }

        const serieLabel = stats.hatSlip
            ? `Tage ohne ${nikotinName} (seit letztem Ausrutscher)`
            : `Tage ohne ${nikotinName}`;

        const totalZeile = stats.startVorbei
            ? `Seit Stichtag: ${stats.tageGesamt} Tage · Ausrutscher: ${stats.slipAnzahl}`
            : '';

        const reminderSupported = 'Notification' in window;
        const reminderActive = data.reminder && data.reminder.enabled && reminderSupported && Notification.permission === 'granted';
        const reminderHTML = reminderSupported ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 13px; border-radius: 12px; margin-bottom: 12px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div>
                        <strong style="font-size: 14px; color: #0f172a;">🔔 Check-in-Erinnerung</strong>
                        <div style="font-size: 12px; color: #64748b;">
                            ${reminderActive ? `Aktiv (ab ${escapeHtml(data.reminder.time)} Uhr)` : 'Ausgeschaltet'}
                        </div>
                    </div>
                    <button type="button" id="btnToggleReminder" style="width: auto; padding: 8px 14px; font-size: 13px; background-color: ${reminderActive ? '#e2e8f0' : '#16a34a'}; color: ${reminderActive ? '#334155' : '#ffffff'};">
                        ${reminderActive ? 'Ausschalten' : 'Aktivieren'}
                    </button>
                </div>
                ${reminderActive ? `
                    <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                        <label for="reminderTime" style="margin: 0; font-size: 13px; white-space: nowrap;">Uhrzeit:</label>
                        <input type="time" id="reminderTime" value="${escapeHtml(data.reminder.time || '19:00')}" style="padding: 6px 10px; font-size: 14px; width: auto;">
                    </div>
                ` : ''}
                <p style="font-size: 11px; color: #64748b; margin: 8px 0 0 0; line-height: 1.35;">
                    Hinweis: Da diese App ohne Server funktioniert, erscheinen Erinnerungen beim Öffnen oder im Hintergrund. Tipp für iPhone/Android: Stelle dir zusätzlich einen täglichen Handy-Wecker, falls du sicher gehen willst.
                </p>
            </div>
        ` : '';

        dashboardCard.innerHTML = `
            ${zukunftHTML}
            ${checkInHTML}

            <button id="sosBtn" class="btn-sos">⚡ Craving SOS – Ich habe Drang!</button>

            <div class="section-card">
                <h2>Dein Fortschritt</h2>
                <div class="grid">
                    <div class="stat-box">
                        <div class="stat-number">${stats.serie}</div>
                        <div class="stat-label">${escapeHtml(serieLabel)}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.gespartesGeld} CHF</div>
                        <div class="stat-label">Gespartes Geld</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.eingesparteEinheiten}</div>
                        <div class="stat-label">${getUnkonsumiertLabel(data.nikotinForm)}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${data.cravingsBewaeltigt}</div>
                        <div class="stat-label">Bewältigte Cravings</div>
                    </div>
                </div>
                ${totalZeile ? `<p style="font-size: 12px; color: #64748b; text-align: center; margin: 4px 0 0 0;">${totalZeile}</p>` : ''}
            </div>

            <div class="section-card">
                <div class="motivation-box">
                    <p style="margin: 0;"><strong>Deine Motivation:</strong> "${escapeHtml(data.gruende)}"</p>
                </div>
            </div>

            <div class="section-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0;">🔍 Trigger-Tagebuch</h3>
                    <button id="btnOpenTrigger" class="btn-small-teal">+ Auslöser loggen</button>
                </div>
                ${ausloeserAuswertung(data)}
                ${triggersHTML}
            </div>

            <div class="section-card">
                <h3>Einstellungen & Hilfe</h3>
                ${reminderHTML}
                <button id="btnOpenHelp" class="btn-help" style="margin-top: 0;">📞 Beratung & Hilfsangebote</button>
                <button id="btnOpenLegal" class="btn-secondary">⚖️ Impressum & Datenschutz</button>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button id="btnExport" class="btn-secondary" style="margin-top: 0; font-size: 14px;">💾 Backup speichern</button>
                    <button id="btnImport" class="btn-secondary" style="margin-top: 0; font-size: 14px;">📂 Backup laden</button>
                </div>
                <button id="resetBtn" class="btn-danger">Daten zurücksetzen</button>
            </div>
        `;

        if (!heuteCheckIn) {
            $('btnCheckinClean').addEventListener('click', () => {
                justCheckedInClean = true;
                speichereCheckIn(data, heuteStr, 'clean');
            });
            $('btnCheckinSlip').addEventListener('click', () => starteRueckfallModus(data, heuteStr));
        }

        const btnToggleReminder = $('btnToggleReminder');
        if (btnToggleReminder) {
            btnToggleReminder.addEventListener('click', async () => {
                if (reminderActive) {
                    data.reminder.enabled = false;
                    saveData(data);
                    showDashboard(data);
                    return;
                }
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    data.reminder.enabled = true;
                    saveData(data);
                    sendeSystemMitteilung(
                        'NikoStopp – Erinnerung aktiv',
                        `Super! Du wirst ab ${data.reminder.time} Uhr an deinen Check-in erinnert, wenn du die App öffnest.`
                    );
                    showDashboard(data);
                } else {
                    alert('Benachrichtigungen wurden im Browser blockiert. Du kannst sie in deinen Browser- oder Geräteeinstellungen erlauben.');
                }
            });
        }

        const reminderTimeInput = $('reminderTime');
        if (reminderTimeInput) {
            reminderTimeInput.addEventListener('change', () => {
                data.reminder.time = reminderTimeInput.value || '19:00';
                saveData(data);
                showDashboard(data);
            });
        }

        $('btnOpenTrigger').addEventListener('click', () => { triggerOverlay.style.display = 'flex'; });
        $('btnOpenHelp').addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
        $('btnOpenLegal').addEventListener('click', () => { legalOverlay.style.display = 'flex'; });
        $('sosBtn').addEventListener('click', () => startSosFlow(data));
        $('btnExport').addEventListener('click', () => exportData(data));
        $('btnImport').addEventListener('click', () => importFile.click());
        $('resetBtn').addEventListener('click', () => {
            if (confirm('Möchtest du deine Daten wirklich löschen und das Onboarding neu starten?\n\nTipp: Speichere vorher ein Backup.')) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        });
    }

    // ── TAB 2: KALENDER MIT PHASENÜBERSICHT ──
    function renderKalenderTab(data, stats) {
        const phaseInfo = getPhaseInfo(stats.serie);

        dashboardCard.innerHTML = `
            <div class="section-card">
                <h2>Kalender & Phasenübersicht</h2>
                <span class="phase-badge">${escapeHtml(phaseInfo.title)}</span>
                <div class="tip-box" style="margin-bottom: 16px;">
                    <strong>Gut zu wissen:</strong> ${escapeHtml(phaseInfo.tip)}
                </div>
                ${renderCalendarHTML(data)}
            </div>
        `;
    }

    // ── TAB 3: COMMITMENT-MODUS ──
    function renderCommitmentTab(data) {
        if (data.commitment && data.commitment.active) {
            const c = data.commitment;
            const startISO = c.startDatumISO || data.stichtag;
            const w = commitmentWerte(c, data);
            const tag = w.tag;
            const zyklusText = w.zyklus === 'täglich' ? 'Tag' : (w.zyklus === 'wöchentlich' ? 'Woche' : 'Monat');

            let einzahlungsListe = '';
            if (w.zyklus === 'täglich') {
                einzahlungsListe = `- Täglich vom ${addDaysFormatted(startISO, 0)} bis ${addDaysFormatted(startISO, ZIEL_TAGE - 1)}: je ${tag.toFixed(2)} CHF (${ZIEL_TAGE} Raten = ${(tag * ZIEL_TAGE).toFixed(2)} CHF)`;
            } else if (w.zyklus === 'wöchentlich') {
                const zeilen = [];
                for (let wo = 0; wo * 7 < ZIEL_TAGE; wo++) {
                    const tageInWoche = Math.min(7, ZIEL_TAGE - wo * 7);
                    zeilen.push(`  • Woche ${wo + 1} (${addDaysFormatted(startISO, wo * 7)}): ${(tag * tageInWoche).toFixed(2)} CHF`);
                }
                einzahlungsListe = zeilen.join('\n');
            } else {
                const zeilen = [];
                for (let m = 0; m < ZIEL_TAGE / 30; m++) {
                    zeilen.push(`  • Monat ${m + 1} (${addDaysFormatted(startISO, m * 30)}): ${(tag * 30).toFixed(2)} CHF`);
                }
                einzahlungsListe = zeilen.join('\n');
            }

            const p1_in = tag * 7,  p1_out = p1_in * 0.5;
            const p2_in = tag * 21, p2_out = p2_in * 0.5;
            const p3_in = tag * 62, p3_out = p3_in * 0.5;
            const p4_in = tag * 90;
            const gesperrteReste = p1_out + p2_out + p3_out;
            const zielAuszahlung = gesperrteReste + p4_in;
            const totalGesamt = tag * ZIEL_TAGE;

            const verfahrensText = `COMMITMENT-VEREINBARUNG ZUM NIKOTINAUSSTIEG

1. BETEILIGTE PERSONEN
Teilnehmer/in: Ich
Vertrauensperson: ${c.personName}
Startdatum: ${addDaysFormatted(startISO, 0)} | Endziel (${ZIEL_TAGE} Tage): ${addDaysFormatted(startISO, ZIEL_TAGE)}

2. EINZAHLUNGSPLAN (${w.zyklus.toUpperCase()})
Ich überweise / übergebe ${w.zyklus} den Betrag von ${w.zyklusBetrag.toFixed(2)} CHF an ${c.personName}:
${einzahlungsListe}

3. AUSZAHLUNGSPLAN AN DEN CHECKPOINTS (50 % RÜCKZAHLUNG)
Bei erfolgreichem Erreichen der Meilensteine zahlt ${c.personName} folgende Beträge zurück:
- Checkpoint 1 – Woche 1 (${addDaysFormatted(startISO, 7)}):
  Eingezahlt: ${p1_in.toFixed(2)} CHF ➔ Auszahlung: ${p1_out.toFixed(2)} CHF (Rest ${p1_out.toFixed(2)} CHF bleibt im Topf)
- Checkpoint 2 – Woche 4 (${addDaysFormatted(startISO, 28)}):
  Eingezahlt (Tag 8–28): ${p2_in.toFixed(2)} CHF ➔ Auszahlung: ${p2_out.toFixed(2)} CHF (Rest ${p2_out.toFixed(2)} CHF bleibt im Topf)
- Checkpoint 3 – Monat 3 (${addDaysFormatted(startISO, 90)}):
  Eingezahlt (Tag 29–90): ${p3_in.toFixed(2)} CHF ➔ Auszahlung: ${p3_out.toFixed(2)} CHF (Rest ${p3_out.toFixed(2)} CHF bleibt im Topf)
- Endziel – Monat 6 (${addDaysFormatted(startISO, ZIEL_TAGE)}):
  Eingezahlt (Tag 91–180): ${p4_in.toFixed(2)} CHF + gesperrte Reste (${gesperrteReste.toFixed(2)} CHF)
  ➔ Schlussauszahlung: ${zielAuszahlung.toFixed(2)} CHF
  (Gesamtrückzahlung bei Erfolg: ${totalGesamt.toFixed(2)} CHF = 100 %)

4. REGEL BEI AUSRUTSCHERN
Bei einem Ausrutscher verfällt kein Geld. Das eingezahlte Guthaben bleibt sicher verwahrt. Lediglich die Zeitfrist für den laufenden Checkpoint startet neu.

5. HINWEIS
Dies ist eine private, freiwillige Absprache zwischen uns beiden und kein rechtlich bindender Vertrag.

Wir tauschen uns regelmässig kurz über meinen Stand aus.`;

            dashboardCard.innerHTML = `
                <div class="section-card">
                    <h2>🤝 Commitment-Vertrag (${escapeHtml(c.personName)})</h2>
                    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 10px; margin-bottom: 14px; font-size: 13px; text-align: left;">
                        <strong>Vertrauensperson:</strong> ${escapeHtml(c.personName)}<br>
                        <strong>Einzahlung:</strong> ${w.zyklusBetrag.toFixed(2)} CHF pro ${zyklusText} (Basis: ${w.tag.toFixed(2)} CHF/Tag)<br>
                        <strong>Rückzahlung an Checkpoints:</strong> 50 %<br>
                        <small>Faire Regel: Kein Geldverlust bei Ausrutschern.</small>
                    </div>

                    <h3>📄 Dein Commitment-Vertrag & Zahlungsplan</h3>
                    <textarea id="vertragText" rows="14" readonly style="font-family: monospace; font-size: 11px; background: #f8fafc; padding: 12px; width: 100%; line-height: 1.4;">${escapeHtml(verfahrensText)}</textarea>

                    <button id="btnCopyVertrag" style="background-color: #0284c7; margin-top: 12px;">📋 Vertrag & Zahlungsplan kopieren</button>
                    <button id="btnDeactivateCommitment" class="btn-danger" style="margin-top: 10px;">Vertrag auflösen</button>
                </div>
            `;

            $('btnCopyVertrag').addEventListener('click', async () => {
                const textarea = $('vertragText');
                textarea.select();
                try {
                    await navigator.clipboard.writeText(textarea.value);
                    alert('Vertrag inklusive kompletter Zahlungsliste kopiert! Du kannst ihn jetzt direkt versenden.');
                } catch (err) {
                    document.execCommand('copy');
                    alert('Text markiert – falls er nicht kopiert wurde, halte ihn gedrückt und wähle „Kopieren“.');
                }
            });

            $('btnDeactivateCommitment').addEventListener('click', () => {
                if (confirm('Möchtest du den Commitment-Vertrag wirklich auflösen?')) {
                    data.commitment = null;
                    saveData(data);
                    showDashboard(data);
                }
            });
            return;
        }

        const tagesBetrag = data.tagesKosten ? data.tagesKosten : 8.00;
        const startVorschlag = data.stichtag > heuteISO() ? data.stichtag : heuteISO();

        dashboardCard.innerHTML = `
            <div class="section-card">
                <h2>🤝 Commitment-Modus</h2>

                <div style="text-align: left; font-size: 13px; line-height: 1.45; background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 10px; margin-bottom: 10px;">
                    <strong>1. Was ist der Commitment-Modus?</strong><br>
                    Du schliesst eine freiwillige Vereinbarung mit einer Vertrauensperson ab: Statt dein Geld für Nikotin auszugeben, zahlst du den Betrag regelmässig an diese Person (z. B. auf ein separates Sparkonto). Bei erreichten Meilensteinen (Checkpoints) bekommst du dein Geld schrittweise zurück. Die App verwaltet kein Geld, sondern erstellt den Zahlungsplan und Vertragstext.
                </div>

                <div style="text-align: left; font-size: 13px; line-height: 1.45; background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 14px; border-radius: 10px; margin-bottom: 16px;">
                    <strong>2. Wieso kann das helfen?</strong><br>
                    Studien zu finanziellen Anreizen beim Rauchstopp deuten darauf hin, dass verbindliche Vereinbarungen die Erfolgschancen erhöhen können. Garantiert ist nichts. Da bei der fairen Regel kein Geld verfällt, liegt die Wirkung hier vor allem in der sozialen Verbindlichkeit gegenüber deiner Vertrauensperson.
                </div>

                <form id="commitmentForm" style="text-align: left;">
                    <div class="form-group">
                        <label for="comName">Name deiner Vertrauensperson:</label>
                        <input type="text" id="comName" placeholder="z. B. Anna (Partner/in, Freund/in)" required>
                    </div>

                    <div class="form-group">
                        <label for="comStart">Startdatum des Vertrags:</label>
                        <input type="date" id="comStart" value="${startVorschlag}" required>
                        <small class="field-hint">Vorschlag: dein Stichtag oder heute, falls der Stichtag schon vorbei ist.</small>
                    </div>

                    <div class="form-group">
                        <label for="comBetrag">Täglicher Basis-Einsatz (in CHF):</label>
                        <input type="number" id="comBetrag" step="0.50" min="0.50" value="${tagesBetrag.toFixed(2)}" required>
                        <small class="field-hint">Basiert auf deinen bisherigen Tageskosten.</small>
                    </div>

                    <div class="form-group">
                        <label for="comZyklus">Einzahlungs-Zyklus:</label>
                        <select id="comZyklus" required>
                            <option value="täglich">Täglich (1× Tagesbetrag)</option>
                            <option value="wöchentlich" selected>Wöchentlich (7× Tagesbetrag)</option>
                            <option value="monatlich">Monatlich (30× Tagesbetrag)</option>
                        </select>
                    </div>

                    <div id="zyklusVorschau" style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 10px; margin-bottom: 14px; font-size: 13px;"></div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px; margin-bottom: 16px; font-size: 12px; color: #475569;">
                        <strong>🛡️ Faire Ausrutscher-Regel:</strong><br>
                        Bei einem Ausrutscher verfällt kein Geld. Dein angespartes Guthaben bleibt sicher – lediglich die Frist für den aktuellen Checkpoint startet neu.
                    </div>

                    <button type="submit" class="btn-commitment" style="margin-top: 0;">Vertrag & Zahlungsplan erstellen</button>
                </form>
            </div>
        `;

        const inputBetrag = $('comBetrag');
        const selectZyklus = $('comZyklus');
        const vorschauBox = $('zyklusVorschau');

        function updateVorschau() {
            const tag = parseFloat(inputBetrag.value) || 0;
            let faktor = 1;
            let einheit = 'Tag';
            if (selectZyklus.value === 'wöchentlich') { faktor = 7; einheit = 'Woche'; }
            else if (selectZyklus.value === 'monatlich') { faktor = 30; einheit = 'Monat (30 Tage)'; }

            vorschauBox.innerHTML = `
                <strong>Deine Zahlungsrate:</strong> ${(tag * faktor).toFixed(2)} CHF pro ${einheit}<br>
                <strong>Gesamter Sparbetrag (${ZIEL_TAGE} Tage):</strong> ${(tag * ZIEL_TAGE).toFixed(2)} CHF<br>
                <small>Bei Erfolg am Zieltag (Monat 6) erhältst du 100 % zurück.</small>
            `;
        }
        updateVorschau();
        inputBetrag.addEventListener('input', updateVorschau);
        selectZyklus.addEventListener('change', updateVorschau);

        $('commitmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const tagesWert = parseFloat(inputBetrag.value);
            const zyklus = selectZyklus.value;
            const faktor = zyklus === 'täglich' ? 1 : (zyklus === 'wöchentlich' ? 7 : 30);

            data.commitment = {
                active: true,
                personName: $('comName').value.trim(),
                tagesBetrag: tagesWert,
                zyklus,
                zyklusBetrag: tagesWert * faktor,
                startDatumISO: $('comStart').value || startVorschlag
            };
            saveData(data);
            showDashboard(data);
        });
    }

    // ── TAB 4: ACT-LEKTIONEN ──
    function renderActTab(data) {
        if (selectedActLessonId) {
            const lektion = actLektionenData.find(l => l.id === selectedActLessonId);
            if (lektion) {
                const done = data.actCompleted.includes(lektion.id);
                dashboardCard.innerHTML = `
                    <div class="section-card">
                        <h2>${escapeHtml(lektion.titel)}</h2>
                        <div style="text-align: left; font-size: 14px; line-height: 1.55; margin: 14px 0;">
                            <p>${escapeHtml(lektion.inhalt)}</p>
                            <div style="background: #f3e8ff; border-left: 4px solid #7c3aed; padding: 12px; border-radius: 10px; margin-top: 12px;">
                                <strong>💡 Praxis-Übung:</strong><br>
                                ${escapeHtml(lektion.uebung)}
                            </div>
                        </div>

                        ${!done
                            ? '<button id="btnCompleteAct" class="btn-act">Lektion abschliessen</button>'
                            : '<p style="color: #16a34a; font-weight: bold; text-align: center;">✅ Diese Lektion hast du absolviert!</p>'}

                        <button type="button" id="btnBackToActList" class="btn-secondary">Zurück zur Übersicht</button>
                    </div>
                `;

                if (!done) {
                    $('btnCompleteAct').addEventListener('click', () => {
                        data.actCompleted.push(lektion.id);
                        saveData(data);
                        showDashboard(data);
                    });
                }
                $('btnBackToActList').addEventListener('click', () => {
                    selectedActLessonId = null;
                    showDashboard(data);
                });
                return;
            }
        }

        const lektionenHTML = actLektionenData.map(l => {
            const done = data.actCompleted.includes(l.id);
            const badge = done
                ? '<span class="act-status" style="color: #16a34a;">✅ Absolviert</span>'
                : '<span class="act-status" style="color: #64748b;">⏳ Offen</span>';
            return `
                <div class="act-card" data-id="${l.id}">
                    ${badge}
                    <div class="act-title">${escapeHtml(l.titel)}</div>
                    <div style="font-size: 13px; color: #475569; margin-top: 4px;">Kategorie: ${escapeHtml(l.kategorie)}</div>
                </div>
            `;
        }).join('');

        dashboardCard.innerHTML = `
            <div class="section-card">
                <h2>🧠 ACT Mentales Training (${data.actCompleted.length}/${actLektionenData.length} absolviert)</h2>
                <p style="font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 16px;">
                    Lerne den Umgang mit Verlangen durch Akzeptanz & Achtsamkeit.
                </p>
                ${lektionenHTML}
            </div>
        `;

        document.querySelectorAll('.act-card').forEach(card => {
            card.addEventListener('click', () => {
                selectedActLessonId = card.getAttribute('data-id');
                showDashboard(data);
            });
        });
    }

    // ───────────────────────── Check-in ─────────────────────────
    function speichereCheckIn(data, datum, status) {
        data.checkIns = data.checkIns.filter(c => c.datum !== datum);
        data.checkIns.push({ datum, status, zeitstempel: new Date().toISOString() });
        saveData(data);
        showDashboard(data);
    }

    function fuegeTriggerHinzu(data, kategorie, notiz) {
        const jetzt = new Date();
        data.triggers.push({
            kategorie,
            notiz,
            ts: jetzt.toISOString(),
            datum: jetzt.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        });
    }

    // ───────────────────────── Onboarding ─────────────────────────
    const stichtagInput = $('stichtag');
    if (stichtagInput && !stichtagInput.value) stichtagInput.value = heuteISO();

    if (onboardingForm) {
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userData = {
                nikotinForm: $('nikotinForm').value,
                tagesMenge: parseInt($('tagesMenge').value, 10),
                tagesKosten: parseFloat($('tagesKosten').value),
                stichtag: $('stichtag').value,
                gruende: $('gruende').value.trim(),
                cravingsBewaeltigt: 0,
                checkIns: [],
                triggers: [],
                actCompleted: [],
                commitment: null,
                reminder: { enabled: false, time: '19:00', lastNotifiedDate: '' },
                erstelltAm: new Date().toISOString()
            };
            saveData(userData);
            showDashboard(userData);
        });
    }

    // ───────────────────────── Modals schliessen / öffnen ─────────────────────────
    if (btnCancelTrigger) btnCancelTrigger.addEventListener('click', () => closeOverlay(triggerOverlay));
    if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => closeOverlay(helpOverlay));
    if (btnCloseLegal) btnCloseLegal.addEventListener('click', () => closeOverlay(legalOverlay));
    if (btnLegalOnboarding) btnLegalOnboarding.addEventListener('click', () => { legalOverlay.style.display = 'flex'; });

    if (triggerForm) {
        triggerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userData = loadData();
            if (!userData) return;
            fuegeTriggerHinzu(userData, $('triggerKategorie').value, $('triggerNotiz').value.trim());
            saveData(userData);
            triggerForm.reset();
            closeOverlay(triggerOverlay);
            showDashboard(userData);
        });
    }

    // ───────────────────────── Backup ─────────────────────────
    function exportData(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nikostopp-backup-${heuteISO()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                if (!parsed || typeof parsed.stichtag !== 'string' || typeof parsed.tagesKosten !== 'number') {
                    throw new Error('Ungültiges Format');
                }
                if (!confirm('Backup laden? Deine aktuellen Daten in dieser App werden überschrieben.')) return;
                saveData(normalisiere(parsed));
                location.reload();
            } catch (err) {
                alert('Diese Datei ist kein gültiges NikoStopp-Backup.');
            }
        };
        reader.readAsText(file);
    }

    if (importFile) {
        importFile.addEventListener('change', () => {
            if (importFile.files && importFile.files[0]) importData(importFile.files[0]);
            importFile.value = '';
        });
    }
    const btnImportOnboarding = $('btnImportOnboarding');
    if (btnImportOnboarding) btnImportOnboarding.addEventListener('click', () => importFile.click());

    // ───────────────────────── Rückfall-Modus ─────────────────────────
    function starteRueckfallModus(data, datumStr) {
        relapseOverlay.style.display = 'flex';
        relapseModalContent.innerHTML = `
            <h3>🌱 Ein Ausrutscher ist kein Scheitern!</h3>
            <p style="font-size: 14px; text-align: left; line-height: 1.5;">
                Ein Ausrutscher bedeutet nicht, dass du wieder am Anfang stehst. Fast alle Menschen haben auf dem Weg zum dauerhaften Stopp Ausrutscher.
            </p>
            <blockquote style="font-style: italic; background: #fffbeb; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 8px; font-size: 13px; text-align: left; margin: 10px 0;">
                Wichtig ist jetzt: Kein schlechtes Gewissen haben, sondern den Auslöser verstehen und sofort weitermachen!
            </blockquote>

            <div class="form-group" style="text-align: left; margin-top: 15px;">
                <label for="relapseTrigger">Was war der Auslöser?</label>
                <select id="relapseTrigger">
                    ${TRIGGER_KATEGORIEN.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
                </select>
            </div>

            <button id="btnFinishRelapse" style="background-color: #16a34a; margin-top: 10px;">Ich mache sofort weiter!</button>
            <button id="btnCancelRelapse" type="button" class="btn-secondary">Doch kein Ausrutscher</button>
        `;

        $('btnFinishRelapse').addEventListener('click', () => {
            fuegeTriggerHinzu(data, `Ausrutscher: ${$('relapseTrigger').value}`, 'Auslöser beim Ausrutscher erfasst.');
            closeOverlay(relapseOverlay);
            speichereCheckIn(data, datumStr, 'slip');
        });
        $('btnCancelRelapse').addEventListener('click', () => closeOverlay(relapseOverlay));
    }

    // ───────────────────────── Craving-SOS ─────────────────────────
    function startSosFlow(userData) {
        sosOverlay.style.display = 'flex';
        renderSosStep1(userData);
    }

    function renderSosStep1(userData) {
        sosModalContent.innerHTML = `
            <h3>1. Impuls benennen</h3>
            <p>Sprich es gedanklich aus:</p>
            <blockquote style="font-style: italic; background: #f1f5f9; padding: 12px; border-radius: 10px; margin: 12px 0;">
                "Ich spüre gerade den starken Drang zu ${getNikotinName(userData.nikotinForm)}."
            </blockquote>
            <p style="font-size: 14px;"><strong>Körper-Check:</strong> Wo spürst du den Drang aktuell in deinem Körper? (z.B. Brust, Bauch, Hals). Beobachte das Gefühl einfach, ohne dagegen zu kämpfen.</p>
            <button id="sosNext1">Weiter: Die Welle beobachten</button>
            <button id="sosCancel" class="btn-secondary">Abbrechen</button>
        `;
        $('sosNext1').addEventListener('click', () => renderSosStep2(userData));
        $('sosCancel').addEventListener('click', closeSos);
    }

    async function haltBildschirmAn() {
        try {
            if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) { /* nicht kritisch */ }
    }

    function renderSosStep2(userData) {
        const endZeit = Date.now() + SOS_DAUER_MS;

        sosModalContent.innerHTML = `
            <h3>2. Die Welle reiten & Ablenkung</h3>
            <p style="font-size: 13px; margin: 4px 0;">Ein Craving baut sich oft schon nach wenigen Minuten, spätestens nach etwa <strong>20 Minuten</strong> von selbst ab:</p>
            <div id="timerDisplay" class="timer-display">10:00</div>

            <div style="text-align: left; background: #dcfce7; padding: 12px; border-radius: 10px; margin-bottom: 10px; font-size: 13px; color: #14532d;">
                <strong>Dein „Warum“:</strong><br>
                <em>"${escapeHtml(userData.gruende)}"</em>
            </div>

            <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px; margin-bottom: 15px; font-size: 13px;">
                <strong>Schnelle Ablenkung:</strong>
                <ul style="margin: 5px 0 0 18px; padding: 0;">
                    <li>Trinke ein grosses Glas kaltes Wasser.</li>
                    <li>Mache 10 Kniebeugen oder gehe an die frische Luft.</li>
                    <li>Lenke deine Hände ab oder rufe jemanden an.</li>
                </ul>
            </div>

            <button id="sosNext2">Weiter zur Entscheidung</button>
            <button id="sosCancel" class="btn-secondary">Abbrechen</button>
        `;

        const timerDisplay = $('timerDisplay');
        if (timerInterval) clearInterval(timerInterval);
        haltBildschirmAn();

        function tick() {
            const rest = Math.max(0, Math.ceil((endZeit - Date.now()) / 1000));
            timerDisplay.textContent = `${Math.floor(rest / 60)}:${pad(rest % 60)}`;
            if (rest <= 0) {
                clearInterval(timerInterval);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                renderSosStep3(userData);
            }
        }
        tick();
        timerInterval = setInterval(tick, 1000);

        $('sosNext2').addEventListener('click', () => {
            clearInterval(timerInterval);
            renderSosStep3(userData);
        });
        $('sosCancel').addEventListener('click', closeSos);
    }

    function renderSosStep3(userData) {
        sosModalContent.innerHTML = `
            <h3>3. Abschluss</h3>
            <p style="font-size: 16px; font-weight: bold; margin: 20px 0;">Wie ist es gelaufen?</p>
            <button id="sosSuccess" style="background-color: #16a34a; padding: 14px; font-size: 16px;">✅ Welle überstanden!</button>
            <button id="sosRelapse" class="btn-warning" style="margin-top: 12px; padding: 14px; font-size: 16px;">❌ Leider nachgegeben (Ausrutscher)</button>
        `;

        $('sosSuccess').addEventListener('click', () => {
            userData.cravingsBewaeltigt = (userData.cravingsBewaeltigt || 0) + 1;
            saveData(userData);
            closeSos();
            showDashboard(userData);
        });

        $('sosRelapse').addEventListener('click', () => {
            closeSos();
            starteRueckfallModus(userData, heuteISO());
        });
    }

    function closeSos() {
        if (timerInterval) clearInterval(timerInterval);
        if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
        closeOverlay(sosOverlay);
    }

    // ───────────────────────── Start ─────────────────────────
    const gespeichert = loadData();
    if (gespeichert) {
        showDashboard(gespeichert);
        pruefeTagesErinnerung(gespeichert);
    }
    setInterval(() => {
        const aktuell = loadData();
        if (aktuell) pruefeTagesErinnerung(aktuell);
    }, 60000);
});