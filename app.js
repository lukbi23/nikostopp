document.addEventListener('DOMContentLoaded', () => {
    const onboardingForm = document.getElementById('onboardingForm');
    const onboardingCard = document.getElementById('onboardingCard');
    const dashboardCard = document.getElementById('dashboardCard');
    const sosOverlay = document.getElementById('sosOverlay');
    const sosModalContent = document.getElementById('sosModalContent');
    const triggerOverlay = document.getElementById('triggerOverlay');
    const triggerForm = document.getElementById('triggerForm');
    const btnCancelTrigger = document.getElementById('btnCancelTrigger');
    const relapseOverlay = document.getElementById('relapseOverlay');
    const relapseModalContent = document.getElementById('relapseModalContent');
    const helpOverlay = document.getElementById('helpOverlay');
    const btnCloseHelp = document.getElementById('btnCloseHelp');
    const actOverlay = document.getElementById('actOverlay');
    const actModalContent = document.getElementById('actModalContent');
    const commitmentOverlay = document.getElementById('commitmentOverlay');
    const commitmentModalContent = document.getElementById('commitmentModalContent');

    let timerInterval = null;
    let justCheckedInClean = false; // Flag für die Erfolgs-Animation beim Check-in

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

    const savedData = localStorage.getItem('nikotinstopp_user_data');
    if (savedData) {
        showDashboard(JSON.parse(savedData));
    }

    if (onboardingForm) {
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const userData = {
                nikotinForm: document.getElementById('nikotinForm').value,
                tagesMenge: parseInt(document.getElementById('tagesMenge').value, 10),
                tagesKosten: parseFloat(document.getElementById('tagesKosten').value),
                stichtag: document.getElementById('stichtag').value,
                gruende: document.getElementById('gruende').value,
                cravingsBewaeltigt: 0,
                checkIns: [],
                triggers: [],
                actCompleted: [],
                commitment: null,
                erstelltAm: new Date().toISOString()
            };

            localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));
            showDashboard(userData);
        });
    }

    function getNikotinName(nikotinForm) {
        if (nikotinForm === 'snus') return 'Snus';
        if (nikotinForm === 'zigaretten') return 'Zigaretten';
        return 'Nikotin';
    }

    function getUnkonsumiertLabel(nikotinForm) {
        if (nikotinForm === 'snus') return 'Unkonsumierte Portionen Snus';
        if (nikotinForm === 'zigaretten') return 'Unkonsumierte Zigaretten';
        return 'Unkonsumierte Einheiten';
    }

    // Hilfsfunktion: 14-Tage Fortschritts-Kalender mit Phasen-Anzeige rendern
    function renderCalendarHTML(data) {
        const stichtagDate = new Date(data.stichtag);
        stichtagDate.setHours(0, 0, 0, 0);

        const heute = new Date();
        heute.setHours(0, 0, 0, 0);
        const heuteStr = heute.toISOString().split('T')[0];

        let daysHTML = '';
        // Zeigt die ersten 14 Tage (kritische Phase) ab Stichtag oder die letzten 14 Tage
        const diffDays = Math.floor((heute.getTime() - stichtagDate.getTime()) / (1000 * 60 * 60 * 24));
        const startOffset = diffDays > 13 ? diffDays - 13 : 0;

        for (let i = 0; i < 14; i++) {
            const dayNumber = startOffset + i + 1; // Tag 1, Tag 2, ...
            const currentDate = new Date(stichtagDate);
            currentDate.setDate(stichtagDate.getDate() + startOffset + i);
            const dateStr = currentDate.toISOString().split('T')[0];

            // Phase bestimmen
            let phaseShort = 'P1';
            if (dayNumber > 30) phaseShort = 'P4';
            else if (dayNumber > 14) phaseShort = 'P3';
            else if (dayNumber > 3) phaseShort = 'P2';

            // Check-in Status suchen
            const checkIn = data.checkIns.find(c => c.datum === dateStr);
            let statusClass = '';
            let icon = '·';

            if (checkIn) {
                if (checkIn.status === 'clean') {
                    statusClass = 'clean';
                    icon = '✅';
                } else {
                    statusClass = 'slip';
                    icon = '⚠️';
                }
            } else if (currentDate < heute) {
                // Vergangene Tage ohne Ausrutscher als rauchfrei werten
                statusClass = 'clean';
                icon = '✓';
            }

            const isTodayClass = (dateStr === heuteStr) ? 'today' : '';

            daysHTML += `
                <div class="cal-day ${statusClass} ${isTodayClass}" title="Tag ${dayNumber} (${dateStr})">
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
                <div class="calendar-grid">
                    ${daysHTML}
                </div>
            </div>
        `;
    }

    // Hauptfunktion: Dashboard rendern
    function showDashboard(data) {
        onboardingCard.style.display = 'none';
        dashboardCard.style.display = 'block';

        if (data.cravingsBewaeltigt === undefined) data.cravingsBewaeltigt = 0;
        if (!data.checkIns) data.checkIns = [];
        if (!data.triggers) data.triggers = [];
        if (!data.actCompleted) data.actCompleted = [];

        const heuteStr = new Date().toISOString().split('T')[0];
        const heute = new Date();
        heute.setHours(0, 0, 0, 0);

        const stichtagDate = new Date(data.stichtag);
        stichtagDate.setHours(0, 0, 0, 0);

        const diffTime = heute.getTime() - stichtagDate.getTime();
        let tageRauchfrei = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (tageRauchfrei < 0) tageRauchfrei = 0;

        const gespartesGeld = (tageRauchfrei * data.tagesKosten).toFixed(2);
        const eingesparteEinheiten = tageRauchfrei * data.tagesMenge;
        const phaseInfo = getPhaseInfo(tageRauchfrei);

        const heuteCheckIn = data.checkIns.find(c => c.datum === heuteStr);

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

        const calendarHTML = renderCalendarHTML(data);

        let triggersHTML = '';
        if (data.triggers.length === 0) {
            triggersHTML = '<p style="font-size: 13px; color: #777;">Noch keine Auslöser eingetragen.</p>';
        } else {
            const meisteTriggers = [...data.triggers].reverse().slice(0, 5);
            triggersHTML = meisteTriggers.map(t => `
                <div class="trigger-item">
                    <div class="trigger-header">
                        <span>${escapeHtml(t.kategorie)}</span>
                        <small style="color:#777; font-weight:normal;">${t.datum}</small>
                    </div>
                    <div>${escapeHtml(t.notiz)}</div>
                </div>
            `).join('');
        }

        const nikotinName = getNikotinName(data.nikotinForm);
        const unkonsumiertText = getUnkonsumiertLabel(data.nikotinForm);
        const actAbsolviertCount = data.actCompleted.length;

        let commitmentButtonText = '🤝 Commitment-Modus einrichten';
        let commitmentInfoHTML = '';

        if (data.commitment && data.commitment.active) {
            const c = data.commitment;
            commitmentButtonText = `🤝 Commitment-Vertrag (${escapeHtml(c.personName)})`;
            commitmentInfoHTML = `
                <div style="background: #fff3e0; border-left: 4px solid #f57c00; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 13px; text-align: left;">
                    <strong>Vertrauensperson:</strong> ${escapeHtml(c.personName)}<br>
                    <strong>Täglicher Einsatz:</strong> ${c.betrag.toFixed(2)} CHF / Tag (${(c.betrag * 7).toFixed(2)} CHF / Woche)<br>
                    <strong>Rückzahlung an Checkpoints:</strong> ${c.prozent}%<br>
                    <small>Regel A (Mild): Kein Geldverlust bei Ausrutschern.</small>
                </div>
            `;
        }

        dashboardCard.innerHTML = `
            ${checkInHTML}

            ${calendarHTML}

            <button id="sosBtn" class="btn-sos">⚡ Craving SOS – Ich habe Drang!</button>

            <h2>Dein Fortschritt</h2>
            <div class="grid">
                <div class="stat-box">
                    <div class="stat-number">${tageRauchfrei}</div>
                    <div class="stat-label">Tage ohne ${nikotinName}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${gespartesGeld} CHF</div>
                    <div class="stat-label">Gespartes Geld</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${eingesparteEinheiten}</div>
                    <div class="stat-label">${unkonsumiertText}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${data.cravingsBewaeltigt}</div>
                    <div class="stat-label">Bewältigte Cravings</div>
                </div>
            </div>

            <div>
                <span class="phase-badge">${escapeHtml(phaseInfo.title)}</span>
                <div class="tip-box">
                    <strong>Evidenz-Hinweis:</strong> ${escapeHtml(phaseInfo.tip)}
                </div>
            </div>

            <div style="margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 16px;">🔍 Trigger-Tagebuch</h3>
                    <button id="btnOpenTrigger" style="width: auto; padding: 6px 12px; font-size: 13px; background-color: #00897b;">+ Auslöser loggen</button>
                </div>
                ${triggersHTML}
            </div>

            <div style="margin-top: 20px;">
                <p><strong>Deine Motivation:</strong> "${escapeHtml(data.gruende)}"</p>
            </div>

            <button id="btnOpenCommitment" class="btn-commitment">${commitmentButtonText}</button>
            ${commitmentInfoHTML}

            <button id="btnOpenAct" class="btn-act">🧠 ACT-Lektionen (${actAbsolviertCount}/4 absolviert)</button>
            <button id="btnOpenHelp" class="btn-help">📞 Beratung & Hilfsangebote</button>
            <button id="resetBtn" class="btn-danger">Daten zurücksetzen</button>
        `;

        if (!heuteCheckIn) {
            document.getElementById('btnCheckinClean')?.addEventListener('click', () => {
                justCheckedInClean = true;
                speichereCheckIn(data, heuteStr, 'clean');
            });
            document.getElementById('btnCheckinSlip')?.addEventListener('click', () => {
                starteRueckfallModus(data, heuteStr);
            });
        }

        document.getElementById('btnOpenTrigger').addEventListener('click', () => {
            triggerOverlay.style.display = 'flex';
        });

        document.getElementById('btnOpenAct').addEventListener('click', () => {
            starteActModus(data);
        });

        document.getElementById('btnOpenCommitment').addEventListener('click', () => {
            starteCommitmentModus(data);
        });

        document.getElementById('btnOpenHelp').addEventListener('click', () => {
            helpOverlay.style.display = 'flex';
        });

        document.getElementById('sosBtn').addEventListener('click', () => startSosFlow(data));
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Möchtest du deine Daten wirklich löschen und das Onboarding neu starten?')) {
                localStorage.removeItem('nikotinstopp_user_data');
                location.reload();
            }
        });
    }

    // COMMITMENT-MODUS LOGIK
    function starteCommitmentModus(data) {
        commitmentOverlay.style.display = 'flex';

        if (data.commitment && data.commitment.active) {
            renderCommitmentVertragView(data);
        } else {
            renderCommitmentForm(data);
        }
    }

    function renderCommitmentForm(data) {
        const tagesBetrag = data.tagesKosten ? data.tagesKosten : 8.00;
        const wochenBetrag = (tagesBetrag * 7).toFixed(2);
        const chk1Einzahlung = (tagesBetrag * 7).toFixed(2);
        const chk1Rueck = (tagesBetrag * 7 * 0.5).toFixed(2);

        commitmentModalContent.innerHTML = `
            <h3>🤝 Commitment-Vertrag (Einzahlungsvertrag)</h3>
            
            <div style="text-align: left; font-size: 13px; line-height: 1.4; background: #e3f2fd; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                <strong>Warum macht das Sinn? (Wissenschaftlicher Hintergrund)</strong><br>
                Reine Willenskraft ist oft die schwächste Strategie. Studien (u.a. New England Journal of Medicine & Cochrane) zeigen, dass Selbstverpflichtungen mit finanziellem Einsatz die Erfolgsquote <strong>mehr als verdoppeln</strong>. Die soziale Verbindlichkeit gegenüber einer Vertrauensperson schafft eine wirksame Hürde gegen spontane Cravings.
            </div>

            <form id="commitmentForm" style="text-align: left;">
                <div class="form-group">
                    <label for="comName">Name deiner Vertrauensperson:</label>
                    <input type="text" id="comName" placeholder="z. B. Anna (Freundin, Partner, Kollege)" required>
                </div>

                <div class="form-group">
                    <label for="comBetrag">Einsatzbetrag pro Tag (in CHF):</label>
                    <input type="number" id="comBetrag" step="0.50" value="${tagesBetrag.toFixed(2)}" required>
                    <small style="color: #666;">Basiert auf deinen bisherigen Tageskosten.</small>
                </div>

                <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 13px;">
                    <strong>💡 Beispielrechnung & Zeiträume:</strong><br>
                    - Täglicher Betrag: <span id="calcTag">${tagesBetrag.toFixed(2)}</span> CHF (${wochenBetrag} CHF / Woche)<br>
                    - <strong>Checkpoint Woche 1 (Tag 7):</strong> ${chk1Einzahlung} CHF eingezahlt ➔ <strong>${chk1Rueck} CHF zurück</strong> (50%), der Rest bleibt bis zum Ziel gesperrt.<br>
                    - <strong>Ziel nach 6 Monaten:</strong> 100% aller gesperrten Reste fliessen an dich zurück. Du verlierst bei Erfolg 0 CHF!
                </div>

                <div style="background: #fff3e0; border-left: 4px solid #f57c00; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 13px;">
                    <strong>🛡️ Regeln bei Ausrutschern (Variante A – Mild):</strong><br>
                    - <strong>Kein Geldverlust:</strong> Bei einem Ausrutscher (z. B. an Tag 5) verfällt dein Geld nicht! Es bleibt sicher auf dem Sparkonto.<br>
                    - <strong>Zeitlicher Reset:</strong> Lediglich die Zählung für den laufenden Checkpoint (z. B. Woche 1) startet von vorn. Das schützt dich vor dem "Jetzt ist auch egal"-Effekt.
                </div>

                <button type="submit" style="background-color: #f57c00;">Vertrag erstellen & aktivieren</button>
                <button type="button" id="btnCloseCommitment" class="btn-secondary">Abbrechen</button>
            </form>
        `;

        const inputBetrag = document.getElementById('comBetrag');
        if (inputBetrag) {
            inputBetrag.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                document.getElementById('calcTag').textContent = val.toFixed(2);
            });
        }

        document.getElementById('commitmentForm').addEventListener('submit', (e) => {
            e.preventDefault();

            data.commitment = {
                active: true,
                personName: document.getElementById('comName').value,
                betrag: parseFloat(document.getElementById('comBetrag').value),
                prozent: 50,
                startDatum: new Date().toLocaleDateString('de-CH')
            };

            localStorage.setItem('nikotinstopp_user_data', JSON.stringify(data));
            renderCommitmentVertragView(data);
            showDashboard(data);
        });

        document.getElementById('btnCloseCommitment').addEventListener('click', () => {
            commitmentOverlay.style.display = 'none';
        });
    }

    function renderCommitmentVertragView(data) {
        const c = data.commitment;
        const tag = c.betrag.toFixed(2);
        const woche = (c.betrag * 7).toFixed(2);

        const verfahrensText = `VEREINBARUNG ZUM NIKOTINAUSSTIEG (COMMITMENT-VERTRAG)

1. VERTRAGSPARTNER
Diese Vereinbarung wird geschlossen zwischen mir und meiner Vertrauensperson ${c.personName}.

2. EINSATZBETRAG & ANSPARUNG
Ich überweise / übergebe ab dem ${c.startDatum} täglich ${tag} CHF (bzw. ${woche} CHF pro Woche) an ${c.personName}. Das Geld wird separat verwahrt.

3. CHECKPOINTS & RÜCKZAHLUNGEN
Bei Erreichen folgender Meilensteine erhalte ich Teilauszahlungen (50% des jeweiligen Zeitraums):
- Woche 1 (Tag 7): 50% Rückzahlung des Wochenbetrags.
- Woche 4 (Tag 28): 50% Rückzahlung des Monatsbetrags.
- Monat 3 (Tag 90): 50% Rückzahlung des Quartalsbetrags.
- Endziel (Monat 6): Auszahlung ALLER verbliebenen gesperrten Reste (100% Gesamtrückzahlung).

4. REGELUNG BEI AUSRUTSCHERN (VARIANTE A - MILD)
Bei einem Ausrutscher verfällt kein Geld. Das bisher eingezahlte Guthaben bleibt sicher im Topf. Lediglich die Zeitfrist des aktuellen Checkpoints startet neu.

Wir sprechen uns regelmässig kurz über meinen Fortschritt.`;

        commitmentModalContent.innerHTML = `
            <h3>📄 Dein Commitment-Vertrag</h3>
            
            <textarea id="vertragText" rows="12" readonly style="font-family: monospace; font-size: 12px; background: #f9f9f9; padding: 10px; width: 100%; box-sizing: border-box;">${verfahrensText}</textarea>

            <button id="btnCopyVertrag" style="background-color: #0288d1; margin-top: 10px;">📋 Text für WhatsApp / E-Mail kopieren</button>
            <button id="btnDeactivateCommitment" class="btn-danger" style="margin-top: 8px;">Vertrag auflösen</button>
            <button type="button" id="btnCloseCommitmentView" class="btn-secondary" style="margin-top: 8px;">Schliessen</button>
        `;

        document.getElementById('btnCopyVertrag').addEventListener('click', () => {
            const copyText = document.getElementById('vertragText');
            copyText.select();
            navigator.clipboard.writeText(copyText.value);
            alert('Vertragstext kopiert! Du kannst ihn jetzt an deine Vertrauensperson senden.');
        });

        document.getElementById('btnDeactivateCommitment').addEventListener('click', () => {
            if (confirm('Möchtest du den Commitment-Vertrag wirklich auflösen?')) {
                data.commitment = null;
                localStorage.setItem('nikotinstopp_user_data', JSON.stringify(data));
                commitmentOverlay.style.display = 'none';
                showDashboard(data);
            }
        });

        document.getElementById('btnCloseCommitmentView').addEventListener('click', () => {
            commitmentOverlay.style.display = 'none';
        });
    }

    // ACT-LEKTIONEN LOGIK
    function starteActModus(data) {
        actOverlay.style.display = 'flex';
        renderActOverview(data);
    }

    function renderActOverview(data) {
        if (!data.actCompleted) data.actCompleted = [];

        const lektionenHTML = actLektionenData.map(l => {
            const isCompleted = data.actCompleted.includes(l.id);
            const statusBadge = isCompleted 
                ? '<span class="act-status" style="color: #2e7d32;">✅ Absolviert</span>' 
                : '<span class="act-status" style="color: #757575;">⏳ Offen</span>';

            return `
                <div class="act-card" data-id="${l.id}">
                    ${statusBadge}
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
                const id = card.getAttribute('data-id');
                const lektion = actLektionenData.find(l => l.id === id);
                if (lektion) {
                    renderActLesson(data, lektion);
                }
            });
        });

        document.getElementById('btnCloseAct').addEventListener('click', () => {
            actOverlay.style.display = 'none';
        });
    }

    function renderActLesson(data, lektion) {
        const isCompleted = data.actCompleted.includes(lektion.id);

        actModalContent.innerHTML = `
            <h3>${escapeHtml(lektion.titel)}</h3>
            
            <div style="text-align: left; font-size: 14px; line-height: 1.5; margin: 15px 0;">
                <p>${escapeHtml(lektion.inhalt)}</p>
                <div style="background: #e1bee7; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <strong>💡 Praxis-Übung:</strong><br>
                    ${escapeHtml(lektion.uebung)}
                </div>
            </div>

            ${!isCompleted ? `<button id="btnCompleteAct" style="background-color: #6a1b9a;">Lektion abschliessen</button>` : `<p style="color: #2e7d32; font-weight: bold;">✅ Diese Lektion hast du absolviert!</p>`}
            
            <button type="button" id="btnBackToActList" class="btn-secondary">Zurück zur Übersicht</button>
        `;

        if (!isCompleted) {
            document.getElementById('btnCompleteAct')?.addEventListener('click', () => {
                data.actCompleted.push(lektion.id);
                localStorage.setItem('nikotinstopp_user_data', JSON.stringify(data));
                renderActLesson(data, lektion);
                showDashboard(data);
            });
        }

        document.getElementById('btnBackToActList').addEventListener('click', () => {
            renderActOverview(data);
        });
    }

    if (btnCloseHelp) {
        btnCloseHelp.addEventListener('click', () => {
            helpOverlay.style.display = 'none';
        });
    }

    // RÜCKFALL-MODUS LOGIK
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
                    <option value="Stress / Ärger">Stress / Ärger</option>
                    <option value="Kaffee / Mahlzeit">Kaffee / Mahlzeit</option>
                    <option value="Geselligkeit / Alkohol">Geselligkeit / Alkohol</option>
                    <option value="Langeweile / Wartezeit">Langeweile / Wartezeit</option>
                    <option value="Gewohnheit / Ort">Gewohnheit / Ort</option>
                    <option value="Spontaner Drang">Spontaner Drang</option>
                </select>
            </div>

            <button id="btnFinishRelapse" style="background-color: #2e7d32; margin-top: 10px;">Ich mache sofort weiter!</button>
        `;

        document.getElementById('btnFinishRelapse').addEventListener('click', () => {
            const ausloeser = document.getElementById('relapseTrigger').value;

            data.triggers.push({
                kategorie: `Ausrutscher: ${ausloeser}`,
                notiz: 'Auslöser beim Ausrutscher erfasst.',
                datum: new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            });

            speichereCheckIn(data, datumStr, 'slip');
            relapseOverlay.style.display = 'none';
        });
    }

    if (triggerForm) {
        triggerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const savedData = localStorage.getItem('nikotinstopp_user_data');
            if (savedData) {
                const userData = JSON.parse(savedData);
                if (!userData.triggers) userData.triggers = [];

                const neuerTrigger = {
                    kategorie: document.getElementById('triggerKategorie').value,
                    notiz: document.getElementById('triggerNotiz').value,
                    datum: new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                };

                userData.triggers.push(neuerTrigger);
                localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));
                
                triggerForm.reset();
                triggerOverlay.style.display = 'none';
                showDashboard(userData);
            }
        });
    }

    if (btnCancelTrigger) {
        btnCancelTrigger.addEventListener('click', () => {
            triggerOverlay.style.display = 'none';
        });
    }

    function speichereCheckIn(data, datum, status) {
        data.checkIns.push({ datum: datum, status: status, zeitstempel: new Date().toISOString() });
        localStorage.setItem('nikotinstopp_user_data', JSON.stringify(data));
        showDashboard(data);
    }

    // CRAVING-SOS SCHRITT-FÜR-SCHRITT PROZESS (Überarbeitet)
    function startSosFlow(userData) {
        sosOverlay.style.display = 'flex';
        renderSosStep1(userData);
    }

    function renderSosStep1(userData) {
        const nikotinName = getNikotinName(userData.nikotinForm);
        sosModalContent.innerHTML = `
            <h3>1. Impuls benennen</h3>
            <p>Sprich es gedanklich aus:</p>
            <blockquote style="font-style: italic; background: #f0f0f0; padding: 10px; border-radius: 6px;">
                "Ich spüre gerade den starken Drang zu ${nikotinName}."
            </blockquote>
            <p><strong>Körper-Check:</strong> Wo spürst du den Drang aktuell in deinem Körper? (z.B. Brust, Bauch, Hals). Beobachte das Gefühl einfach, ohne dagegen zu kämpfen.</p>
            <button id="sosNext1">Weiter: Die Welle beobachten</button>
            <button id="sosCancel" class="btn-secondary">Abbrechen</button>
        `;

        document.getElementById('sosNext1').addEventListener('click', () => renderSosStep2(userData));
        document.getElementById('sosCancel').addEventListener('click', closeSos);
    }

    // Schritt 2: Timer läuft UND Motivation + Ablenkungs-Tipps sind eingeblendet
    function renderSosStep2(userData) {
        let timeLeft = 600;

        sosModalContent.innerHTML = `
            <h3>2. Die Welle reiten & Ablenkung</h3>
            <p style="font-size: 13px; margin: 4px 0;">Ein Craving baut sich nach <strong>10 bis 20 Minuten</strong> von selbst ab:</p>
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

        const timerDisplay = document.getElementById('timerDisplay');
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerDisplay.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

            // Wenn Timer abgelaufen ist -> automatisch zur Entscheidung wechseln
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                renderSosStep3(userData);
            }
        }, 1000);

        document.getElementById('sosNext2').addEventListener('click', () => {
            clearInterval(timerInterval);
            renderSosStep3(userData);
        });
        document.getElementById('sosCancel').addEventListener('click', closeSos);
    }

    // Schritt 3: Reine Abschlussfrage ("Wie ist es gelaufen?")
    function renderSosStep3(userData) {
        sosModalContent.innerHTML = `
            <h3>3. Abschluss</h3>
            <p style="font-size: 16px; font-weight: bold; margin: 20px 0;">Wie ist es gelaufen?</p>
            
            <button id="sosSuccess" style="background-color: #2e7d32; padding: 14px; font-size: 16px;">✅ Welle überstanden!</button>
            <button id="sosRelapse" class="btn-warning" style="margin-top: 12px; padding: 14px; font-size: 16px;">❌ Leider nachgegeben (Ausrutscher)</button>
        `;

        document.getElementById('sosSuccess').addEventListener('click', () => {
            userData.cravingsBewaeltigt = (userData.cravingsBewaeltigt || 0) + 1;
            localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));
            closeSos();
            showDashboard(userData);
        });

        document.getElementById('sosRelapse').addEventListener('click', () => {
            closeSos();
            const heuteStr = new Date().toISOString().split('T')[0];
            starteRueckfallModus(userData, heuteStr);
        });
    }

    function closeSos() {
        if (timerInterval) clearInterval(timerInterval);
        sosOverlay.style.display = 'none';
    }

    function getPhaseInfo(tage) {
        if (tage <= 3) {
            return {
                title: "Phase 1: Tag 1–3 (Akutphase)",
                tip: "Entzugssymptome erreichen ihren Höhepunkt um Tag 3 und klingen danach stetig ab. Denke daran: Einzelne Cravings dauern meist nur 10 bis 20 Minuten."
            };
        } else if (tage <= 14) {
            return {
                title: "Phase 2: Woche 1–2 (Kritische Phase)",
                tip: "Die meisten Rückfälle passieren in den ersten 14 Tagen. Halte durch! Der schwerste körperliche Teil ist fast geschafft."
            };
        } else if (tage <= 30) {
            return {
                title: "Phase 3: Monat 1 (Stabilisierung)",
                tip: "Entzugssymptome klingen in 3 bis 4 Wochen weitgehend ab. Der körperliche Drang lässt nach, beobachte weiter deine Verhaltensauslöser."
            };
        } else {
            return {
                title: "Phase 4: Monat 2+ (Langzeit-Festigung)",
                tip: "Starke Leistung! Bleibe wachsam bei spontanen Auslösern. Akzeptiere plötzliche Impulse als kurze Wellen, ohne sie zu bekämpfen."
            };
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (match) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return map[match];
        });
    }
});