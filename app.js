document.addEventListener('DOMContentLoaded', () => {
    // ───────────────────────── Elemente ─────────────────────────
    const $ = (id) => document.getElementById(id);
    const onboardingForm = $('onboardingForm');
    const onboardingCard = $('onboardingCard');
    const dashboardCard = $('dashboardCard');
    const sosOverlay = $('sosOverlay');
    const sosModalContent = $('sosModalContent');
    const triggerOverlay = $('triggerOverlay');
    const triggerForm = $('triggerForm');
    const btnCancelTrigger = $('btnCancelTrigger');
    const relapseOverlay = $('relapseOverlay');
    const relapseModalContent = $('relapseModalContent');
    const helpOverlay = $('helpOverlay');
    const btnCloseHelp = $('btnCloseHelp');
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

    // Datumsfunktionen arbeiten bewusst mit LOKALER Zeit (nicht UTC),
    // sonst stimmen Tage in der Schweiz um 1–2 Stunden nach Mitternacht nicht.
    function pad(n) { return String(n).padStart(2, '0'); }
    function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function parseISODate(s) {
        const [y, m, d] = String(s).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    }
    function heuteISO() { return toISODate(new Date()); }
    function tageZwischen(neuer, aelter) {
        // Differenz in ganzen Kalendertagen (sommerzeit-sicher)
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
            // Alte Verträge: Datum aus "TT.MM.JJJJ" übernehmen, sonst Stichtag
            const m = String(data.commitment.startDatum || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            data.commitment.startDatumISO = m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : data.stichtag;
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

    // ───────────────────────── Statistik ─────────────────────────
    function berechneStatistik(data) {
        const heute = new Date();
        heute.setHours(0, 0, 0, 0);
        const start = parseISODate(data.stichtag);

        const tageGesamt = Math.max(0, tageZwischen(heute, start));
        const startVorbei = tageZwischen(heute, start) >= 0;

        // Ausrutscher-Tage seit Stichtag (eindeutige Daten)
        const slipDaten = [...new Set(
            data.checkIns
                .filter(c => c.status === 'slip' && c.datum >= data.stichtag)
                .map(c => c.datum)
        )].sort();

        const letzterSlip = slipDaten.length ? slipDaten[slipDaten.length - 1] : null;
        const heuteStr = toISODate(heute);

        // Aktuelle Serie: Tage seit dem letzten Ausrutscher (sonst seit Stichtag)
        const serie = letzterSlip
            ? Math.max(0, tageZwischen(heute, parseISODate(letzterSlip)))
            : tageGesamt;

        // Nur vergangene Ausrutscher-Tage verringern die Ersparnis
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
                    <strong style="font-size: 14px; color: #2c3e50;">🗓️ Dein 14-Tage-Verlauf & Phasen</strong>
                    <small style="font-size: 11px; color: #666;">P1: Tag 1-3 | P2: W1-2</small>
                </div>
                <div class="calendar-grid">${daysHTML}</div>
            </div>
        `;
    }

    // ───────────────────────── Dashboard ─────────────────────────
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
        return `<p style="font-size: 13px; color: #00695c; margin: 0 0 10px 0;">📊 Häufigster Auslöser: <strong>${escapeHtml(top[0])}</strong> (${top[1]}×)</p>`;
    }

    function showDashboard(data) {
        normalisiere(data);
        onboardingCard.style.display = 'none';
        dashboardCard.style.display = 'block';

        const heuteStr = heuteISO();
        const stats = berechneStatistik(data);
        const phaseInfo = getPhaseInfo(stats.serie);
        const heuteCheckIn = data.checkIns.find(c => c.datum === heuteStr);
        const nikotinName = getNikotinName(data.nikotinForm);

        // Check-in-Bereich
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
                    <div class="tip-box" style="margin-bottom: 20px; background: #e8f5e9; border-left-color: #2e7d32;">
                        <strong>Tages-Check-in erledigt:</strong> ✅ Heute frei geblieben! Super gemacht.
                    </div>
                `;
            }
        } else {
            checkInHTML = `
                <div class="tip-box" style="margin-bottom: 20px; background: #fff3e0; border-left-color: #f57c00;">
                    <strong>Tages-Check-in erledigt:</strong> ⚠️ Ausrutscher verbucht. Schwamm drüber – direkt weitermachen!
                </div>
            `;
        }

        // Stichtag liegt in der Zukunft
        const zukunftHTML = !stats.startVorbei ? `
            <div class="tip-box" style="margin-bottom: 20px;">
                <strong>Dein Stichtag ist am ${formatDatum(parseISODate(data.stichtag))}.</strong>
                Bis dahin zählt die App noch nicht – bereite dich vor und schau dir die ACT-Lektionen an.
            </div>
        ` : '';

        // Trigger-Tagebuch
        let triggersHTML;
        if (data.triggers.length === 0) {
            triggersHTML = '<p style="font-size: 13px; color: #777;">Noch keine Auslöser eingetragen.</p>';
        } else {
            triggersHTML = [...data.triggers].reverse().slice(0, 5).map(t => `
                <div class="trigger-item">
                    <div class="trigger-header">
                        <span>${escapeHtml(t.kategorie)}</span>
                        <small style="color:#777; font-weight:normal;">${escapeHtml(formatTriggerZeit(t))}</small>
                    </div>
                    <div>${escapeHtml(t.notiz)}</div>
                </div>
            `).join('');
        }

        // Commitment
        let commitmentButtonText = '🤝 Commitment-Modus einrichten';
        let commitmentInfoHTML = '';
        if (data.commitment && data.commitment.active) {
            const c = data.commitment;
            const w = commitmentWerte(c, data);
            const zyklusText = w.zyklus === 'täglich' ? 'Tag' : (w.zyklus === 'wöchentlich' ? 'Woche' : 'Monat');
            commitmentButtonText = `🤝 Commitment-Vertrag (${escapeHtml(c.personName)})`;
            commitmentInfoHTML = `
                <div style="background: #fff3e0; border-left: 4px solid #f57c00; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 13px; text-align: left;">
                    <strong>Vertrauensperson:</strong> ${escapeHtml(c.personName)}<br>
                    <strong>Einzahlung:</strong> ${w.zyklusBetrag.toFixed(2)} CHF pro ${zyklusText} (Basis: ${w.tag.toFixed(2)} CHF/Tag)<br>
                    <strong>Rückzahlung an Checkpoints:</strong> 50 %<br>
                    <small>Faire Regel: Kein Geldverlust bei Ausrutschern.</small>
                </div>
            `;
        }

        const serieLabel = stats.hatSlip
            ? `Tage ohne ${nikotinName} (seit letztem Ausrutscher)`
            : `Tage ohne ${nikotinName}`;

        const totalZeile = stats.startVorbei
            ? `Seit Stichtag: ${stats.tageGesamt} Tage · Ausrutscher: ${stats.slipAnzahl}`
            : '';

        dashboardCard.innerHTML = `
            ${zukunftHTML}
            ${checkInHTML}

            <button id="sosBtn" class="btn-sos">⚡ Craving SOS – Ich habe Drang!</button>

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
            ${totalZeile ? `<p style="font-size: 12px; color: #666; text-align: center; margin: -5px 0 15px 0;">${totalZeile}</p>` : ''}

            ${renderCalendarHTML(data)}

            <div>
                <span class="phase-badge">${escapeHtml(phaseInfo.title)}</span>
                <div class="tip-box">
                    <strong>Gut zu wissen:</strong> ${escapeHtml(phaseInfo.tip)}
                </div>
            </div>

            <div style="margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 16px;">🔍 Trigger-Tagebuch</h3>
                    <button id="btnOpenTrigger" style="width: auto; padding: 6px 12px; font-size: 13px; background-color: #00897b;">+ Auslöser loggen</button>
                </div>
                ${ausloeserAuswertung(data)}
                ${triggersHTML}
            </div>

            <div style="margin-top: 20px;">
                <p><strong>Deine Motivation:</strong> "${escapeHtml(data.gruende)}"</p>
            </div>

            <button id="btnOpenCommitment" class="btn-commitment">${commitmentButtonText}</button>
            ${commitmentInfoHTML}

            <button id="btnOpenAct" class="btn-act">🧠 ACT-Lektionen (${data.actCompleted.length}/${actLektionenData.length} absolviert)</button>
            <button id="btnOpenHelp" class="btn-help">📞 Beratung & Hilfsangebote</button>

            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button id="btnExport" class="btn-secondary" style="margin-top: 0; font-size: 14px;">💾 Backup speichern</button>
                <button id="btnImport" class="btn-secondary" style="margin-top: 0; font-size: 14px;">📂 Backup laden</button>
            </div>
            <button id="resetBtn" class="btn-danger">Daten zurücksetzen</button>
        `;

        if (!heuteCheckIn) {
            $('btnCheckinClean').addEventListener('click', () => {
                justCheckedInClean = true;
                speichereCheckIn(data, heuteStr, 'clean');
            });
            $('btnCheckinSlip').addEventListener('click', () => starteRueckfallModus(data, heuteStr));
        }

        $('btnOpenTrigger').addEventListener('click', () => { triggerOverlay.style.display = 'flex'; });
        $('btnOpenAct').addEventListener('click', () => starteActModus(data));
        $('btnOpenCommitment').addEventListener('click', () => starteCommitmentModus(data));
        $('btnOpenHelp').addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
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

    // ───────────────────────── Check-in ─────────────────────────
    function speichereCheckIn(data, datum, status) {
        // Pro Tag nur ein Eintrag: ein späterer Eintrag ersetzt den früheren
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
                erstelltAm: new Date().toISOString()
            };
            saveData(userData);
            showDashboard(userData);
        });
    }

    // ───────────────────────── Trigger-Formular ─────────────────────────
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
    if (btnCancelTrigger) btnCancelTrigger.addEventListener('click', () => closeOverlay(triggerOverlay));
    if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => closeOverlay(helpOverlay));

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

    // ───────────────────────── Commitment ─────────────────────────
    function starteCommitmentModus(data) {
        commitmentOverlay.style.display = 'flex';
        if (data.commitment && data.commitment.active) renderCommitmentVertragView(data);
        else renderCommitmentForm(data);
    }

    function renderCommitmentForm(data) {
        const tagesBetrag = data.tagesKosten ? data.tagesKosten : 8.00;
        // Vorschlag: Stichtag, falls er noch in der Zukunft liegt, sonst heute
        const startVorschlag = data.stichtag > heuteISO() ? data.stichtag : heuteISO();

        commitmentModalContent.innerHTML = `
            <h3>🤝 Commitment-Modus</h3>

            <div style="text-align: left; font-size: 13px; line-height: 1.4; background: #fff8e1; border-left: 4px solid #ffa000; padding: 10px 12px; border-radius: 6px; margin-bottom: 10px;">
                <strong>1. Was ist der Commitment-Modus?</strong><br>
                Du schliesst eine freiwillige Vereinbarung mit einer Vertrauensperson ab: Statt dein Geld für Nikotin auszugeben, zahlst du den Betrag regelmässig an diese Person (z. B. auf ein separates Sparkonto). Bei erreichten Meilensteinen (Checkpoints) bekommst du dein Geld schrittweise zurück. Die App verwaltet kein Geld, sondern erstellt den Zahlungsplan und Vertragstext.
            </div>

            <div style="text-align: left; font-size: 13px; line-height: 1.4; background: #e3f2fd; border-left: 4px solid #1976d2; padding: 10px 12px; border-radius: 6px; margin-bottom: 15px;">
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
                    <small style="color: #666;">Vorschlag: dein Stichtag oder heute, falls der Stichtag schon vorbei ist.</small>
                </div>

                <div class="form-group">
                    <label for="comBetrag">Täglicher Basis-Einsatz (in CHF):</label>
                    <input type="number" id="comBetrag" step="0.50" min="0.50" value="${tagesBetrag.toFixed(2)}" required>
                    <small style="color: #666;">Basiert auf deinen bisherigen Tageskosten.</small>
                </div>

                <div class="form-group">
                    <label for="comZyklus">Einzahlungs-Zyklus:</label>
                    <select id="comZyklus" required>
                        <option value="täglich">Täglich (1× Tagesbetrag)</option>
                        <option value="wöchentlich" selected>Wöchentlich (7× Tagesbetrag)</option>
                        <option value="monatlich">Monatlich (30× Tagesbetrag)</option>
                    </select>
                </div>

                <div id="zyklusVorschau" style="background: #f1f8e9; border: 1px solid #c5e1a5; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 13px;"></div>

                <div style="background: #f5f5f5; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 12px; color: #555;">
                    <strong>🛡️ Faire Ausrutscher-Regel:</strong><br>
                    Bei einem Ausrutscher verfällt kein Geld. Dein angespartes Guthaben bleibt sicher – lediglich die Frist für den aktuellen Checkpoint startet neu.
                </div>

                <button type="submit" style="background-color: #f57c00;">Vertrag & Zahlungsplan erstellen</button>
                <button type="button" id="btnCloseCommitment" class="btn-secondary">Abbrechen</button>
            </form>
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
            renderCommitmentVertragView(data);
            showDashboard(data);
        });

        $('btnCloseCommitment').addEventListener('click', () => closeOverlay(commitmentOverlay));
    }

    function renderCommitmentVertragView(data) {
        const c = data.commitment;
        const startISO = c.startDatumISO || data.stichtag;
        const w = commitmentWerte(c, data);
        const tag = w.tag;

        // Einzahlungsplan (summiert sich immer exakt auf 180 Tage)
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

        commitmentModalContent.innerHTML = `
            <h3>📄 Dein Commitment-Vertrag & Zahlungsplan</h3>
            <textarea id="vertragText" rows="14" readonly style="font-family: monospace; font-size: 11px; background: #f9f9f9; padding: 10px; width: 100%; box-sizing: border-box; line-height: 1.4;">${escapeHtml(verfahrensText)}</textarea>

            <button id="btnCopyVertrag" style="background-color: #0288d1; margin-top: 10px;">📋 Vertrag & Zahlungsplan kopieren</button>
            <button id="btnDeactivateCommitment" class="btn-danger" style="margin-top: 8px;">Vertrag auflösen</button>
            <button type="button" id="btnCloseCommitmentView" class="btn-secondary" style="margin-top: 8px;">Schliessen</button>
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
                closeOverlay(commitmentOverlay);
                showDashboard(data);
            }
        });

        $('btnCloseCommitmentView').addEventListener('click', () => closeOverlay(commitmentOverlay));
    }

    // ───────────────────────── ACT-Lektionen ─────────────────────────
    function starteActModus(data) {
        actOverlay.style.display = 'flex';
        renderActOverview(data);
    }

    function renderActOverview(data) {
        const lektionenHTML = actLektionenData.map(l => {
            const done = data.actCompleted.includes(l.id);
            const badge = done
                ? '<span class="act-status" style="color: #2e7d32;">✅ Absolviert</span>'
                : '<span class="act-status" style="color: #757575;">⏳ Offen</span>';
            return `
                <div class="act-card" data-id="${l.id}">
                    ${badge}
                    <div class="act-title">${escapeHtml(l.titel)}</div>
                    <div style="font-size: 13px; color: #555; margin-top: 4px;">Kategorie: ${escapeHtml(l.kategorie)}</div>
                </div>
            `;
        }).join('');

        actModalContent.innerHTML = `
            <h3>🧠 ACT Mentales Training</h3>
            <p style="font-size: 14px; color: #555; margin-bottom: 15px;">
                Lerne den Umgang mit Verlangen durch Akzeptanz & Achtsamkeit.
            </p>
            ${lektionenHTML}
            <button type="button" id="btnCloseAct" class="btn-secondary" style="margin-top: 10px;">Schliessen</button>
        `;

        document.querySelectorAll('.act-card').forEach(card => {
            card.addEventListener('click', () => {
                const lektion = actLektionenData.find(l => l.id === card.getAttribute('data-id'));
                if (lektion) renderActLesson(data, lektion);
            });
        });
        $('btnCloseAct').addEventListener('click', () => closeOverlay(actOverlay));
    }

    function renderActLesson(data, lektion) {
        const done = data.actCompleted.includes(lektion.id);

        actModalContent.innerHTML = `
            <h3>${escapeHtml(lektion.titel)}</h3>

            <div style="text-align: left; font-size: 14px; line-height: 1.5; margin: 15px 0;">
                <p>${escapeHtml(lektion.inhalt)}</p>
                <div style="background: #e1bee7; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <strong>💡 Praxis-Übung:</strong><br>
                    ${escapeHtml(lektion.uebung)}
                </div>
            </div>

            ${!done
                ? '<button id="btnCompleteAct" style="background-color: #6a1b9a;">Lektion abschliessen</button>'
                : '<p style="color: #2e7d32; font-weight: bold;">✅ Diese Lektion hast du absolviert!</p>'}

            <button type="button" id="btnBackToActList" class="btn-secondary">Zurück zur Übersicht</button>
        `;

        if (!done) {
            $('btnCompleteAct').addEventListener('click', () => {
                data.actCompleted.push(lektion.id);
                saveData(data);
                renderActLesson(data, lektion);
                showDashboard(data);
            });
        }
        $('btnBackToActList').addEventListener('click', () => renderActOverview(data));
    }

    // ───────────────────────── Rückfall-Modus ─────────────────────────
    function starteRueckfallModus(data, datumStr) {
        relapseOverlay.style.display = 'flex';
        relapseModalContent.innerHTML = `
            <h3>🌱 Ein Ausrutscher ist kein Scheitern!</h3>
            <p style="font-size: 14px; text-align: left; line-height: 1.5;">
                Ein Ausrutscher bedeutet nicht, dass du wieder am Anfang stehst. Fast alle Menschen haben auf dem Weg zum dauerhaften Stopp Ausrutscher.
            </p>
            <blockquote style="font-style: italic; background: #fff3e0; padding: 10px; border-left: 4px solid #f57c00; font-size: 13px; text-align: left; margin: 10px 0;">
                Wichtig ist jetzt: Kein schlechtes Gewissen haben, sondern den Auslöser verstehen und sofort weitermachen!
            </blockquote>

            <div class="form-group" style="text-align: left; margin-top: 15px;">
                <label for="relapseTrigger">Was war der Auslöser?</label>
                <select id="relapseTrigger">
                    ${TRIGGER_KATEGORIEN.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
                </select>
            </div>

            <button id="btnFinishRelapse" style="background-color: #2e7d32; margin-top: 10px;">Ich mache sofort weiter!</button>
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
            <blockquote style="font-style: italic; background: #f0f0f0; padding: 10px; border-radius: 6px;">
                "Ich spüre gerade den starken Drang zu ${getNikotinName(userData.nikotinForm)}."
            </blockquote>
            <p><strong>Körper-Check:</strong> Wo spürst du den Drang aktuell in deinem Körper? (z.B. Brust, Bauch, Hals). Beobachte das Gefühl einfach, ohne dagegen zu kämpfen.</p>
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
        // Endzeit statt Herunterzählen: bleibt korrekt, auch wenn das Handy kurz gesperrt wird
        const endZeit = Date.now() + SOS_DAUER_MS;

        sosModalContent.innerHTML = `
            <h3>2. Die Welle reiten & Ablenkung</h3>
            <p style="font-size: 13px; margin: 4px 0;">Ein Craving baut sich oft schon nach wenigen Minuten, spätestens nach etwa <strong>20 Minuten</strong> von selbst ab:</p>
            <div id="timerDisplay" class="timer-display">10:00</div>

            <div style="text-align: left; background: #e8f5e9; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; color: #1b5e20;">
                <strong>Dein „Warum“:</strong><br>
                <em>"${escapeHtml(userData.gruende)}"</em>
            </div>

            <div style="text-align: left; background: #f5f5f5; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 13px;">
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
            <button id="sosSuccess" style="background-color: #2e7d32; padding: 14px; font-size: 16px;">✅ Welle überstanden!</button>
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
    if (gespeichert) showDashboard(gespeichert);
});
