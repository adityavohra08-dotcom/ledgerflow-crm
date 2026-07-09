/**
 * LedgerFlow — Unified GST Invoice PDF Template (CGST Rule 46)
 * Themes: light / dark — synced with profile Appearance (ledgerflow_theme).
 */
(function () {
    'use strict';

    const STATE_NAMES = {
        '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
        '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
        '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
        '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
        '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
        '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
        '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
        '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Ladakh', '38': 'Other Territory'
    };

    const INVOICE_THEMES = {
        light: {
            page: '#ffffff',
            text: '#0f172a',
            muted: '#64748b',
            border: '#e2e8f0',
            surface: '#f8fafc',
            card: '#ffffff',
            hero: 'linear-gradient(135deg, #0f172a 0%, #115e59 55%, #0d9488 100%)',
            heroText: '#ffffff',
            heroMuted: 'rgba(255,255,255,0.82)',
            accent: '#0d9488',
            accentSoft: 'rgba(13, 148, 136, 0.1)',
            tableHead: '#f1f5f9',
            tableHeadText: '#334155',
            tableStripe: '#fafbfc',
            rowHover: '#f8fafc',
            grandBg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            grandText: '#065f46',
            grandBorder: '#059669',
            wordsBg: '#fffbeb',
            wordsBorder: '#fde68a',
            wordsText: '#92400e',
            badgeGst: '#fef3c7',
            badgeGstText: '#a16207',
            cgst: '#059669',
            igst: '#2563eb',
            purple: '#7c3aed',
            ewayBg: '#fffbeb',
            ewayBorder: '#fcd34d',
            shadow: '0 4px 24px rgba(15, 23, 42, 0.06)'
        },
        dark: {
            page: '#0f172a',
            text: '#e2e8f0',
            muted: '#94a3b8',
            border: 'rgba(148, 163, 184, 0.18)',
            surface: '#1e293b',
            card: '#162032',
            hero: 'linear-gradient(135deg, #070b14 0%, #0f172a 40%, #134e4a 100%)',
            heroText: '#f8fafc',
            heroMuted: 'rgba(226, 232, 240, 0.75)',
            accent: '#2dd4bf',
            accentSoft: 'rgba(45, 212, 191, 0.12)',
            tableHead: '#1e293b',
            tableHeadText: '#cbd5e1',
            tableStripe: 'rgba(30, 41, 59, 0.45)',
            rowHover: 'rgba(30, 41, 59, 0.65)',
            grandBg: 'linear-gradient(135deg, rgba(13, 148, 136, 0.25) 0%, rgba(45, 212, 191, 0.12) 100%)',
            grandText: '#5eead4',
            grandBorder: '#2dd4bf',
            wordsBg: 'rgba(251, 191, 36, 0.1)',
            wordsBorder: 'rgba(251, 191, 36, 0.35)',
            wordsText: '#fcd34d',
            badgeGst: 'rgba(251, 191, 36, 0.15)',
            badgeGstText: '#fbbf24',
            cgst: '#34d399',
            igst: '#60a5fa',
            purple: '#a78bfa',
            ewayBg: 'rgba(245, 158, 11, 0.1)',
            ewayBorder: 'rgba(245, 158, 11, 0.35)',
            shadow: '0 8px 32px rgba(0, 0, 0, 0.35)'
        }
    };

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function stateName(code) {
        return STATE_NAMES[String(code)] || code || '—';
    }

    function fmt(n) {
        return (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function numberToWords(num) {
        const n = Math.round(parseFloat(num) || 0);
        if (n === 0) return 'Zero Rupees Only';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        function lt1000(x) {
            if (x >= 100) return ones[Math.floor(x / 100)] + ' Hundred ' + lt1000(x % 100);
            if (x >= 20) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
            return ones[x];
        }
        const crore = Math.floor(n / 10000000);
        const lakh = Math.floor((n % 10000000) / 100000);
        const thousand = Math.floor((n % 100000) / 1000);
        const rem = n % 1000;
        let r = '';
        if (crore) r += lt1000(crore) + ' Crore ';
        if (lakh) r += lt1000(lakh) + ' Lakh ';
        if (thousand) r += lt1000(thousand) + ' Thousand ';
        if (rem) r += lt1000(rem);
        return r.trim() + ' Rupees Only';
    }

    window.resolveInvoiceTheme = function resolveInvoiceTheme(data) {
        if (data?.theme === 'light' || data?.theme === 'dark') return data.theme;
        try {
            const pref = localStorage.getItem('ledgerflow_theme') || 'light';
            if (pref === 'system') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return pref === 'dark' ? 'dark' : 'light';
        } catch {
            return 'light';
        }
    };

    function buildInvoiceCss(themeId) {
        const t = INVOICE_THEMES[themeId] || INVOICE_THEMES.light;
        return `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');
        .gst-pdf-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 13px; line-height: 1.5; color: ${t.text}; }
        .gst-pdf-preview {
            width: 794px; background: ${t.page}; padding: 0; box-sizing: border-box;
            border-radius: 20px; overflow: hidden; box-shadow: ${t.shadow};
        }
        .gst-pdf-accent-bar { height: 5px; background: ${t.hero}; }
        .gst-pdf-hero {
            display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
            padding: 28px 32px 24px; background: ${t.hero}; color: ${t.heroText};
        }
        .gst-pdf-hero-left { display: flex; gap: 16px; align-items: flex-start; min-width: 0; }
        .gst-pdf-logo {
            width: 68px; height: 68px; object-fit: contain; border-radius: 14px;
            background: rgba(255,255,255,0.95); padding: 6px; flex-shrink: 0;
        }
        .gst-pdf-logo-ph {
            width: 68px; height: 68px; border-radius: 14px; flex-shrink: 0;
            background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
            display: flex; align-items: center; justify-content: center; font-size: 26px;
        }
        .gst-pdf-co { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
        .gst-pdf-addr { font-size: 11px; color: ${t.heroMuted}; margin-top: 4px; white-space: pre-line; line-height: 1.45; }
        .gst-pdf-meta { font-size: 11px; margin-top: 8px; color: ${t.heroMuted}; }
        .gst-pdf-meta strong { color: ${t.heroText}; }
        .gst-pdf-hero-right { text-align: right; flex-shrink: 0; }
        .gst-pdf-title {
            font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase; color: ${t.accent}; opacity: 0.95;
        }
        .gst-pdf-title-main {
            font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700;
            letter-spacing: -0.03em; line-height: 1.1; margin-top: 4px;
        }
        .gst-pdf-invno {
            font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; margin-top: 8px;
        }
        .gst-pdf-inv-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; font-size: 11px; text-align: left; }
        .gst-pdf-inv-meta label { display: block; color: ${t.heroMuted}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
        .gst-pdf-inv-meta span { font-weight: 600; }
        .gst-pdf-body { padding: 24px 32px 32px; }
        .gst-pdf-chips { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 18px; }
        .gst-pdf-chip {
            display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
            border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
            background: ${t.accentSoft}; color: ${t.accent}; border: 1px solid ${t.border};
        }
        .gst-pdf-chip--supply { text-transform: uppercase; }
        .gst-pdf-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .gst-pdf-party {
            border: 1px solid ${t.border}; border-radius: 16px; padding: 16px 16px 16px 18px;
            background: ${t.card}; position: relative; overflow: hidden;
        }
        .gst-pdf-party::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${t.accent};
        }
        .gst-pdf-section-title {
            font-size: 9px; font-weight: 800; color: ${t.accent}; letter-spacing: 0.12em;
            text-transform: uppercase; margin-bottom: 6px;
        }
        .gst-pdf-party-name { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; }
        .gst-pdf-table-wrap { margin-top: 22px; border: 1px solid ${t.border}; border-radius: 16px; overflow: hidden; }
        .gst-pdf-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        .gst-pdf-table th {
            background: ${t.tableHead}; font-weight: 700; font-size: 9px; color: ${t.tableHeadText};
            padding: 11px 8px; text-align: left; letter-spacing: 0.04em; text-transform: uppercase;
            border-bottom: 2px solid ${t.border};
        }
        .gst-pdf-table td { padding: 10px 8px; border-bottom: 1px solid ${t.border}; vertical-align: top; }
        .gst-pdf-table tbody tr:nth-child(even) td { background: ${t.tableStripe}; }
        .gst-pdf-table .r { text-align: right; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .gst-pdf-table .c { text-align: center; }
        .gst-pdf-badge {
            display: inline-block; padding: 2px 8px; background: ${t.badgeGst}; color: ${t.badgeGstText};
            font-size: 10px; font-weight: 700; border-radius: 6px;
        }
        .gst-pdf-totals-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
        .gst-pdf-totals {
            width: 100%; max-width: 380px; border: 1px solid ${t.border}; border-radius: 16px;
            overflow: hidden; font-size: 13px; background: ${t.card};
        }
        .gst-pdf-totals td { padding: 10px 18px; border-bottom: 1px solid ${t.border}; }
        .gst-pdf-totals .r { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; }
        .gst-pdf-grand td {
            background: ${t.grandBg}; border-top: 2px solid ${t.grandBorder} !important;
            font-weight: 800; font-size: 15px; color: ${t.grandText};
            font-family: 'Space Grotesk', sans-serif;
        }
        .gst-pdf-words {
            margin-top: 10px; font-size: 11px; background: ${t.wordsBg}; border: 1px solid ${t.wordsBorder};
            color: ${t.wordsText}; padding: 12px 14px; border-radius: 14px; line-height: 1.45;
        }
        .gst-pdf-footer2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 22px; font-size: 11px; }
        .gst-pdf-footer2 .gst-pdf-party { background: ${t.surface}; }
        .gst-pdf-sign {
            margin-top: 24px; padding-top: 20px; border-top: 1px solid ${t.border};
            display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px;
        }
        .gst-pdf-footnote {
            text-align: center; margin-top: 20px; font-size: 9px; color: ${t.muted};
            letter-spacing: 0.08em; text-transform: uppercase;
        }
        .gst-pdf-theme-tag {
            display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
            font-size: 8px; font-weight: 700; background: ${t.accentSoft}; color: ${t.accent};
        }
        .gst-emerald { color: ${t.cgst}; }
        .gst-blue { color: ${t.igst}; }
        .gst-purple { color: ${t.purple}; }
        .gst-eway {
            margin-top: 16px; padding: 14px 16px; border: 1px dashed ${t.ewayBorder};
            background: ${t.ewayBg}; border-radius: 14px; font-size: 11px;
        }
        .gst-eway-title { font-weight: 800; color: ${t.badgeGstText}; letter-spacing: 0.06em; text-transform: uppercase; font-size: 9px; }
        .gst-eway-no { font-family: 'JetBrains Mono', monospace; font-size: 17px; font-weight: 700; margin-top: 4px; }
        `;
    }

    function formatEwbNoPdf(no) {
        const s = String(no || '').replace(/\D/g, '');
        if (s.length !== 12) return esc(no);
        return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)}`;
    }

    function buildEwayPdfBlock(eway, t) {
        if (!eway?.ewbNo) return '';
        const valid = eway.validUpto ? new Date(eway.validUpto).toLocaleString('en-IN') : '—';
        const modes = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' };
        const mode = modes[eway.transportMode] || 'Road';
        return `<div class="gst-eway">
            <div class="gst-eway-title">E-Way Bill Details</div>
            <div class="gst-eway-no">${formatEwbNoPdf(eway.ewbNo)}</div>
            <div style="color:${t.muted};margin-top:6px;">Generated: ${esc(eway.ewbDate || '—')} • Valid upto: ${esc(valid)}</div>
            <div style="color:${t.muted};margin-top:4px;">Transport: ${esc(mode)}${eway.vehicleNo ? ' • Vehicle: ' + esc(eway.vehicleNo) : ''}${eway.distanceKm ? ' • ' + esc(eway.distanceKm) + ' km' : ''}</div>
            ${eway.transporterName ? `<div style="color:${t.muted};margin-top:4px;">Transporter: ${esc(eway.transporterName)}</div>` : ''}
        </div>`;
    }

    window.buildGSTInvoiceHTML = function (data) {
        const themeId = resolveInvoiceTheme(data);
        const t = INVOICE_THEMES[themeId];
        const s = data.supplier || {};
        const r = data.recipient || {};
        const ship = data.shipTo || { sameAsBillTo: true };
        const inv = data.invoice || {};
        const bank = data.bank || {};
        const totals = data.totals || {};
        const items = data.items || [];
        const isIntra = totals.isIntraState !== false && (totals.totalIGST || 0) === 0;
        const pos = stateName(inv.placeOfSupplyCode || r.stateCode || s.stateCode);
        const supplyColor = isIntra ? t.cgst : t.igst;

        let rows = '';
        if (!items.length) {
            rows = `<tr><td colspan="13" style="text-align:center;padding:36px;color:${t.muted};font-style:italic;">No line items</td></tr>`;
        } else {
            items.forEach((item, i) => {
                rows += `<tr>
                    <td class="c" style="font-weight:700;color:${t.muted};">${i + 1}</td>
                    <td style="font-weight:600;">${esc(item.desc || item.description || '—')}</td>
                    <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${t.muted};">${esc(item.hsn || '—')}</td>
                    <td class="c">${item.qty ?? 1}</td>
                    <td style="font-size:10px;">${esc(item.unit || 'Nos')}</td>
                    <td class="r">${fmt(item.rate)}</td>
                    <td class="c">${item.discPercent ?? 0}%</td>
                    <td class="r" style="font-weight:600;">${fmt(item.taxable)}</td>
                    <td class="c"><span class="gst-pdf-badge">${item.gstPercent ?? 18}%</span></td>
                    <td class="r gst-emerald">${item.cgst > 0 ? fmt(item.cgst) : '—'}</td>
                    <td class="r gst-emerald">${item.sgst > 0 ? fmt(item.sgst) : '—'}</td>
                    <td class="r gst-blue">${item.igst > 0 ? fmt(item.igst) : '—'}</td>
                    <td class="r" style="font-weight:800;">${fmt(item.total ?? (item.taxable + (item.cgst||0) + (item.sgst||0) + (item.igst||0)))}</td>
                </tr>`;
            });
        }

        let taxRows = '';
        if (isIntra) {
            taxRows += `<tr><td>CGST</td><td class="r gst-emerald">₹ ${fmt(totals.totalCGST)}</td></tr>`;
            taxRows += `<tr><td>SGST</td><td class="r gst-emerald">₹ ${fmt(totals.totalSGST)}</td></tr>`;
        } else {
            taxRows += `<tr><td>IGST</td><td class="r gst-blue">₹ ${fmt(totals.totalIGST)}</td></tr>`;
        }
        if (totals.roundOff) {
            taxRows += `<tr><td>Round Off</td><td class="r">${totals.roundOff > 0 ? '+' : ''}₹ ${fmt(totals.roundOff)}</td></tr>`;
        }
        if (totals.tcsEnabled && totals.tcsAmount) {
            taxRows += `<tr><td class="gst-purple">TCS @ ${totals.tcsRate}% (${esc(totals.tcsSection)})</td><td class="r gst-purple">₹ ${fmt(totals.tcsAmount)}</td></tr>`;
        }

        return `<div class="gst-pdf-root" data-invoice-theme="${themeId}"><style>${buildInvoiceCss(themeId)}</style>
        <div class="gst-pdf-preview">
            <div class="gst-pdf-accent-bar"></div>
            <div class="gst-pdf-hero">
                <div class="gst-pdf-hero-left">
                    ${s.logo ? `<img src="${s.logo}" class="gst-pdf-logo" alt="Logo">` : `<div class="gst-pdf-logo-ph">&#9889;</div>`}
                    <div>
                        <div class="gst-pdf-co">${esc(s.name || 'Supplier')}</div>
                        <div class="gst-pdf-addr">${esc(s.address || '')}</div>
                        <div class="gst-pdf-meta">
                            <strong>GSTIN</strong> <span style="font-family:'JetBrains Mono',monospace;">${esc(s.gstin || 'N/A')}</span>
                            ${s.pan ? ` &nbsp; <strong>PAN</strong> <span style="font-family:'JetBrains Mono',monospace;">${esc(s.pan)}</span>` : ''}
                        </div>
                        <div class="gst-pdf-meta">${esc(s.phone || '')}${s.email ? ' • ' + esc(s.email) : ''}</div>
                    </div>
                </div>
                <div class="gst-pdf-hero-right">
                    <div class="gst-pdf-title">GST Tax Invoice</div>
                    <div class="gst-pdf-title-main">TAX INVOICE</div>
                    <div class="gst-pdf-invno">${esc(inv.number || 'INV-0000')}</div>
                    <div class="gst-pdf-inv-meta">
                        <div><label>Invoice Date</label><span>${esc(inv.date || '')}</span></div>
                        <div><label>Due Date</label><span>${esc(inv.dueDate || '—')}</span></div>
                    </div>
                </div>
            </div>

            <div class="gst-pdf-body">
                <div class="gst-pdf-chips">
                    <span class="gst-pdf-chip"><strong>POS</strong> ${pos}</span>
                    <span class="gst-pdf-chip gst-pdf-chip--supply" style="color:${supplyColor};border-color:${supplyColor}33;">
                        ${isIntra ? 'Intra-State · CGST + SGST' : 'Inter-State · IGST'}
                    </span>
                </div>

                <div class="gst-pdf-grid2">
                    <div class="gst-pdf-party">
                        <div class="gst-pdf-section-title">Bill To</div>
                        <div class="gst-pdf-party-name">${esc(r.name || 'Customer')}</div>
                        <div class="gst-pdf-addr" style="color:${t.muted};margin-top:4px;">${esc(r.address || '')}</div>
                        <div style="margin-top:8px;font-size:11px;">
                            ${r.gstin
                                ? `<span style="font-family:'JetBrains Mono',monospace;background:${t.surface};padding:3px 10px;border-radius:8px;border:1px solid ${t.border};">${esc(r.gstin)}</span>`
                                : `<span style="color:${t.badgeGstText};font-weight:600;">Unregistered</span>`}
                            <span style="color:${t.muted};margin-left:8px;">${stateName(r.stateCode)}</span>
                        </div>
                    </div>
                    <div class="gst-pdf-party">
                        <div class="gst-pdf-section-title">Ship To</div>
                        ${ship.sameAsBillTo !== false
                            ? `<div style="font-style:italic;color:${t.muted};font-size:11px;">Same as Bill To address</div>`
                            : `<div class="gst-pdf-party-name">${esc(ship.name || r.name)}</div>
                               <div class="gst-pdf-addr" style="color:${t.muted};margin-top:4px;">${esc(ship.address || r.address || '')}</div>
                               <div style="margin-top:4px;font-size:11px;color:${t.muted};">${stateName(ship.stateCode || r.stateCode)}</div>`}
                    </div>
                </div>

                <div class="gst-pdf-table-wrap">
                    <table class="gst-pdf-table">
                        <thead><tr>
                            <th class="c" style="width:28px;">#</th>
                            <th>Description</th>
                            <th style="width:72px;">HSN/SAC</th>
                            <th class="c" style="width:36px;">Qty</th>
                            <th style="width:44px;">Unit</th>
                            <th class="r" style="width:68px;">Rate</th>
                            <th class="c" style="width:44px;">Disc</th>
                            <th class="r" style="width:80px;">Taxable</th>
                            <th class="c" style="width:44px;">GST</th>
                            <th class="r" style="width:64px;">CGST</th>
                            <th class="r" style="width:64px;">SGST</th>
                            <th class="r" style="width:64px;">IGST</th>
                            <th class="r" style="width:72px;">Total</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>

                <div class="gst-pdf-totals-wrap">
                    <div style="width:380px;">
                        <table class="gst-pdf-totals" style="width:100%;border-collapse:collapse;">
                            <tr><td>Total Taxable Value</td><td class="r">₹ ${fmt(totals.totalTaxable)}</td></tr>
                            ${taxRows}
                            <tr class="gst-pdf-grand"><td>GRAND TOTAL${totals.tcsEnabled ? ' (incl. TCS)' : ''}</td><td class="r">₹ ${fmt(totals.finalGrandTotal ?? totals.grandTotal)}</td></tr>
                        </table>
                        <div class="gst-pdf-words"><strong>Amount in words:</strong><br>${numberToWords(totals.finalGrandTotal ?? totals.grandTotal)}</div>
                    </div>
                </div>

                ${buildEwayPdfBlock(data.ewayBill, t)}

                <div class="gst-pdf-footer2">
                    <div class="gst-pdf-party">
                        <div class="gst-pdf-section-title">Bank Details</div>
                        ${bank.name ? `
                            <div><strong>Bank:</strong> ${esc(bank.name)}</div>
                            <div><strong>A/c:</strong> <span style="font-family:'JetBrains Mono',monospace;">${esc(bank.account)}</span></div>
                            <div><strong>IFSC:</strong> <span style="font-family:'JetBrains Mono',monospace;">${esc(bank.ifsc)}</span></div>
                            <div><strong>Branch:</strong> ${esc(bank.branch)}</div>`
                            : `<div style="font-style:italic;color:${t.muted};">Bank details not provided</div>`}
                    </div>
                    <div class="gst-pdf-party">
                        <div class="gst-pdf-section-title">Terms &amp; Conditions</div>
                        <div style="white-space:pre-line;font-size:11px;color:${t.muted};line-height:1.45;">${esc(data.terms || 'Standard terms apply.')}</div>
                        ${data.notes ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed ${t.border};"><strong class="gst-emerald">Note:</strong> ${esc(data.notes)}</div>` : ''}
                    </div>
                </div>

                <div class="gst-pdf-sign">
                    <div style="max-width:280px;color:${t.muted};">
                        <div style="font-weight:700;color:${t.text};">Declaration</div>
                        <div style="line-height:1.45;margin-top:4px;">We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.</div>
                        <div style="margin-top:10px;font-size:10px;">Computer generated invoice — signature not required.</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:${t.muted};margin-bottom:4px;">For <strong style="color:${t.text};">${esc(s.name)}</strong></div>
                        <div style="height:48px;"></div>
                        <div style="border-top:1px solid ${t.border};padding-top:6px;">
                            <div style="font-weight:700;">Authorized Signatory</div>
                        </div>
                    </div>
                </div>

                <div class="gst-pdf-footnote">
                    GST Compliant · CGST Rule 46 · LedgerFlow
                    <span class="gst-pdf-theme-tag">${themeId} theme</span>
                </div>
            </div>
        </div></div>`;
    };

    window.crmClientInvoiceToPDFData = function (client, inv) {
        const customer = (client.customers || []).find(c => c.name === inv.partyName);
        const isIntra = !(inv.igst > 0);
        let items = [];
        if (inv.itemDetails?.length) {
            items = inv.itemDetails.map(it => ({
                desc: it.desc || it.description,
                hsn: it.hsn || '9983',
                qty: it.qty ?? 1,
                unit: it.unit || 'Nos',
                rate: it.rate ?? 0,
                discPercent: it.discPercent ?? 0,
                taxable: it.taxable ?? 0,
                gstPercent: it.gstPercent ?? 18,
                cgst: it.cgst ?? 0,
                sgst: it.sgst ?? 0,
                igst: it.igst ?? 0,
                total: it.total ?? (it.taxable + (it.cgst||0) + (it.sgst||0) + (it.igst||0))
            }));
        } else {
            const gstPct = inv.taxable > 0 ? Math.round(((inv.cgst + inv.sgst + inv.igst) / inv.taxable) * 100) : 18;
            items = [{
                desc: 'Goods / Services as per invoice',
                hsn: '9983', qty: inv.items || 1, unit: 'Nos',
                rate: inv.taxable / (inv.items || 1),
                discPercent: 0, taxable: inv.taxable, gstPercent: gstPct,
                cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst, total: inv.grandTotal
            }];
        }
        return {
            theme: resolveInvoiceTheme(),
            supplier: {
                name: client.name, address: client.address, gstin: client.gstin, pan: client.pan,
                phone: client.phone, email: client.email, logo: client.logo, stateCode: client.stateCode
            },
            recipient: {
                name: inv.partyName, address: customer?.address || '', gstin: customer?.gstin || '',
                stateCode: customer?.stateCode || client.stateCode
            },
            shipTo: { sameAsBillTo: true },
            invoice: {
                number: inv.number, date: inv.date, dueDate: inv.dueDate || '',
                placeOfSupplyCode: customer?.stateCode || client.stateCode
            },
            bank: client.bank || {},
            terms: client.terms, notes: client.notes || '',
            ewayBill: inv.ewayBill || null,
            items,
            totals: {
                totalTaxable: inv.taxable, totalCGST: inv.cgst, totalSGST: inv.sgst, totalIGST: inv.igst,
                roundOff: inv.roundOff || 0,
                tcsEnabled: (inv.tcs || 0) > 0, tcsRate: inv.tcsRate || 0, tcsSection: inv.tcsSection || '',
                tcsAmount: inv.tcs || 0, finalGrandTotal: inv.grandTotal, isIntraState: isIntra
            }
        };
    };

    window.adminInvoiceToPDFData = function (client, inv) {
        if (typeof normalizeAdminInvoice === 'function') normalizeAdminInvoice(inv, client);
        if (typeof ensureFirmSettings === 'function') ensureFirmSettings();
        const firm = inv.billFrom || appData.firmSettings;
        const buyer = inv.billTo || {
            name: client.name, gstin: client.gstin, address: client.address,
            stateCode: client.stateCode, phone: client.phone, email: client.email
        };
        const isIntra = !(inv.igst > 0);
        const items = inv.items?.length ? inv.items.map(it => ({
            desc: it.description || it.desc || inv.serviceName,
            hsn: it.hsn || inv.hsnSac || '9983',
            qty: it.qty ?? 1, unit: it.unit || 'Service', rate: it.rate ?? inv.taxable,
            discPercent: 0, taxable: it.taxable ?? inv.taxable, gstPercent: it.gstPercent ?? inv.gstPercent ?? 18,
            cgst: it.cgst ?? inv.cgst, sgst: it.sgst ?? inv.sgst, igst: it.igst ?? inv.igst,
            total: (it.taxable ?? inv.taxable) + (it.cgst ?? inv.cgst) + (it.sgst ?? inv.sgst) + (it.igst ?? inv.igst)
        })) : [{
            desc: inv.serviceName, hsn: inv.hsnSac || '9983', qty: 1, unit: 'Service',
            rate: inv.taxable, discPercent: 0, taxable: inv.taxable, gstPercent: inv.gstPercent || 18,
            cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst,
            total: inv.grandTotal || (inv.taxable + inv.cgst + inv.sgst + inv.igst)
        }];
        return {
            theme: resolveInvoiceTheme(),
            supplier: {
                name: firm.name, address: firm.address, gstin: firm.gstin, pan: firm.pan,
                phone: firm.phone, email: firm.email, logo: firm.logo, stateCode: firm.stateCode
            },
            recipient: {
                name: buyer.name, address: buyer.address || '', gstin: buyer.gstin || '',
                stateCode: buyer.stateCode || client.stateCode
            },
            shipTo: { sameAsBillTo: true },
            invoice: {
                number: inv.number, date: inv.date, dueDate: inv.dueDate || '',
                placeOfSupplyCode: inv.placeOfSupply || buyer.stateCode
            },
            bank: firm.bank || {},
            terms: inv.terms || firm.terms, notes: inv.description || '',
            items,
            totals: {
                totalTaxable: inv.taxable, totalCGST: inv.cgst, totalSGST: inv.sgst, totalIGST: inv.igst,
                roundOff: 0, tcsEnabled: false, finalGrandTotal: inv.grandTotal, isIntraState: isIntra
            }
        };
    };

    window.downloadGSTInvoicePDF = async function (pdfData, fileName) {
        if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            if (typeof showToast === 'function') showToast('PDF libraries not loaded', 'error');
            return;
        }
        let renderEl = document.getElementById('gst-invoice-pdf-render');
        if (!renderEl) {
            renderEl = document.createElement('div');
            renderEl.id = 'gst-invoice-pdf-render';
            renderEl.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
            document.body.appendChild(renderEl);
        }
        renderEl.innerHTML = buildGSTInvoiceHTML(pdfData);
        const target = renderEl.querySelector('.gst-pdf-preview');
        if (!target) return;

        const themeId = resolveInvoiceTheme(pdfData);
        const bg = INVOICE_THEMES[themeId]?.page || '#ffffff';

        try {
            if (typeof showToast === 'function') showToast('Generating PDF...', 'info');
            const canvas = await html2canvas(target, {
                scale: 2.2, useCORS: true, backgroundColor: bg, logging: false
            });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const availableWidth = pdfWidth - margin * 2;
            const availableHeight = pdfHeight - margin * 2;
            const ratio = Math.min(
                availableWidth / (canvas.width * 0.264583),
                availableHeight / (canvas.height * 0.264583)
            );
            const imgWidth = canvas.width * 0.264583 * ratio;
            const imgHeight = canvas.height * 0.264583 * ratio;
            const x = (pdfWidth - imgWidth) / 2;
            pdf.addImage(canvas.toDataURL('image/png', 0.95), 'PNG', x, margin, imgWidth, imgHeight);
            pdf.save(fileName || `GST_Invoice_${pdfData.invoice?.number || 'INV'}_${new Date().toISOString().slice(0, 10)}.pdf`);
            if (typeof showToast === 'function') showToast('GST Invoice PDF downloaded');
        } catch (e) {
            console.error(e);
            if (typeof showToast === 'function') showToast('PDF generation failed', 'error');
        } finally {
            renderEl.innerHTML = '';
        }
    };

})();